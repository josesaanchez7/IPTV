import Hls, { type ErrorData } from 'hls.js';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { isMixedContent } from '../lib/streamCheck';
import { useIPTVStore } from '../store/useIPTVStore';

const START_TIMEOUT_MS = 25000;

/** Una resolución disponible en el stream (`index` es el nivel de hls.js). */
export type QualityLevel = { index: number; height: number };

/** Resoluciones distintas del stream, de mayor a menor; con varias velocidades de la misma, la mejor. */
function qualityLevels(hls: Hls): QualityLevel[] {
  const best = new Map<number, { index: number; bitrate: number }>();
  hls.levels.forEach((level, index) => {
    if (!level.height) return;
    const known = best.get(level.height);
    if (!known || level.bitrate > known.bitrate) best.set(level.height, { index, bitrate: level.bitrate });
  });
  return [...best].map(([height, { index }]) => ({ index, height })).sort((a, b) => b.height - a.height);
}

/**
 * Fija la resolución de `hls`: `null` es automática; con un valor, la más alta que no lo supere o,
 * si todas lo superan, la más baja. Así una preferencia de 720p también sirve en canales sin 720p.
 */
function applyHeight(hls: Hls, levels: QualityLevel[], height: number | null) {
  if (height === null || !levels.length) {
    hls.currentLevel = -1;
    return;
  }
  const pick = levels.find((l) => l.height <= height) ?? levels[levels.length - 1];
  if (pick) hls.currentLevel = pick.index;
}

const MESSAGES = {
  mixed: 'Este canal usa una conexión no segura (http) y el navegador lo bloquea en páginas https.',
  timeout: 'El canal no responde (tiempo de espera agotado).',
  blocked:
    'No se puede acceder al canal desde el navegador. Puede estar caído, geobloqueado o no permitir peticiones externas (CORS).',
  forbidden: 'Acceso denegado al canal. Probablemente esté geobloqueado o requiera autorización.',
  notFound: 'El canal no existe o ya no emite (enlace caído).',
  media: 'El navegador no puede decodificar este stream.',
  unsupported: 'Formato no soportado o enlace caído.',
  slowStart: 'El canal tarda demasiado en arrancar.',
  noHls: 'Tu navegador no soporta la reproducción de streams HLS.',
  unknown: 'Error inesperado al reproducir el canal.',
};

function describeNetworkError(data: ErrorData): string {
  if (data.details?.endsWith('TimeOut')) return MESSAGES.timeout;
  const code = data.response?.code ?? 0;
  if (code === 401 || code === 403) return `${MESSAGES.forbidden} (${code})`;
  if (code === 404 || code === 410) return `${MESSAGES.notFound} (${code})`;
  if (code >= 400) return `El servidor del canal respondió con un error (${code}).`;
  return MESSAGES.blocked;
}

/**
 * Reproduce `url` en `videoRef` con HLS.js (o HLS nativo en Safari).
 * Nunca lanza: cualquier fallo termina en `status: 'error'` con un mensaje legible.
 * `url` en el resultado indica a qué stream corresponde el estado: justo tras cambiar
 * de canal aún puede ser el del anterior.
 */
export type HlsStatus = 'loading' | 'playing' | 'error';

type HlsState = {
  status: HlsStatus;
  error: string | null;
  /** Stream al que corresponde este estado. */
  url: string | null;
};

export function useHls(videoRef: RefObject<HTMLVideoElement | null>, url: string) {
  const [state, setState] = useState<HlsState>({ status: 'loading', error: null, url: null });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [activeLevel, setActiveLevel] = useState(-1);
  const hlsRef = useRef<Hls | null>(null);

  /** Cambia la resolución del canal en reproducción y la recuerda para los siguientes (`null`: automática). */
  const setQuality = useCallback(
    (height: number | null) => {
      useIPTVStore.getState().setPreferredHeight(height);
      if (hlsRef.current) applyHeight(hlsRef.current, levels, height);
    },
    [levels],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    let disposed = false;
    let hls: Hls | null = null;
    setState({ status: 'loading', error: null, url });
    setLevels([]);
    setActiveLevel(-1);

    const destroyHls = () => {
      hls?.destroy();
      hls = null;
      hlsRef.current = null;
    };

    const fail = (error: string) => {
      if (disposed) return;
      destroyHls();
      setState({ status: 'error', error, url });
    };

    const tryPlay = () => {
      video.play().catch((err: unknown) => {
        if (disposed || !(err instanceof DOMException) || err.name !== 'NotAllowedError') return;
        // Autoplay bloqueado: se reintenta en silencio; si tampoco, el usuario pulsará play.
        video.muted = true;
        video.play().catch(() => {});
      });
    };

    const onPlaying = () => {
      if (!disposed) setState({ status: 'playing', error: null, url });
    };

    const onNativeError = () => {
      fail(video.error?.code === MediaError.MEDIA_ERR_DECODE ? MESSAGES.media : MESSAGES.unsupported);
    };

    const playNative = () => {
      video.addEventListener('error', onNativeError);
      video.addEventListener('loadedmetadata', tryPlay, { once: true });
      video.src = url;
    };

    video.addEventListener('playing', onPlaying);

    const watchdog = setTimeout(() => {
      if (!disposed && video.readyState < 2) {
        setState((s) => {
          if (s.status !== 'loading') return s;
          destroyHls();
          return { status: 'error', error: MESSAGES.slowStart, url };
        });
      }
    }, START_TIMEOUT_MS);

    if (isMixedContent(url)) {
      fail(MESSAGES.mixed);
    } else if (Hls.isSupported()) {
      let networkRetried = false;
      let mediaRecovered = false;
      const instance = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        manifestLoadingTimeOut: 15000,
        manifestLoadingMaxRetry: 1,
        levelLoadingTimeOut: 15000,
      });
      hls = instance;
      hlsRef.current = instance;
      instance.on(Hls.Events.MANIFEST_PARSED, () => {
        const available = qualityLevels(instance);
        setLevels(available);
        applyHeight(instance, available, useIPTVStore.getState().preferredHeight);
        tryPlay();
      });
      instance.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => setActiveLevel(data.level));
      instance.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal || disposed) return;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
            // No es HLS: puede ser un MP4/TS directo que el <video> sepa reproducir.
            destroyHls();
            playNative();
            return;
          }
          const isManifestError = data.details.startsWith('manifest');
          if (!isManifestError && !networkRetried) {
            networkRetried = true;
            instance.startLoad();
            return;
          }
          fail(describeNetworkError(data));
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          if (!mediaRecovered) {
            mediaRecovered = true;
            instance.recoverMediaError();
            return;
          }
          fail(MESSAGES.media);
        } else {
          fail(MESSAGES.unknown);
        }
      });
      instance.loadSource(url);
      instance.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      playNative();
    } else {
      fail(MESSAGES.noHls);
    }

    return () => {
      disposed = true;
      clearTimeout(watchdog);
      destroyHls();
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', onNativeError);
      video.removeEventListener('loadedmetadata', tryPlay);
      video.removeAttribute('src');
      video.load();
    };
  }, [videoRef, url, attempt]);

  return { ...state, retry, levels, activeLevel, setQuality };
}
