import {
  CalendarClock,
  ExternalLink,
  Heart,
  List,
  LoaderCircle,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  Search,
  SkipBack,
  SkipForward,
  TriangleAlert,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useChannelNumber } from '../hooks/useChannelNumber';
import { useChannelPrograms } from '../hooks/useNowNext';
import { useHls } from '../hooks/useHls';
import { officialLive } from '../lib/officialLive';
import { filterChannels } from '../lib/playlist';
import { useIPTVStore } from '../store/useIPTVStore';
import { useUIStore } from '../store/useUIStore';
import { reportPlayback, useStreamStatus } from '../store/useStreamStatus';
import type { Channel } from '../types';
import { badgeLabels } from './ChannelBadges';
import ChannelLogo from './ChannelLogo';
import { GuidePanel, NowNextText } from './Guide';
import QualityMenu from './QualityMenu';

const HIDE_CONTROLS_MS = 3000;
const PANEL_MAX_ITEMS = 300;
/** Desplazamiento horizontal mínimo del dedo sobre el vídeo para cambiar de canal. */
const SWIPE_MIN_PX = 60;

/** Gira a horizontal al entrar en pantalla completa (Android). `lock` no está en los tipos del DOM. */
function lockLandscape() {
  const orientation: ScreenOrientation & { lock?: (type: 'landscape') => Promise<void> } = screen.orientation;
  orientation.lock?.('landscape').catch(() => {});
}

export default function VideoPlayerModal() {
  const channel = useIPTVStore((s) => s.activeChannel);
  return channel ? <Player channel={channel} /> : null;
}

/** El reproductor en sí. Solo se monta con un canal activo, así que `channel` nunca es null. */
function Player({ channel }: { channel: Channel }) {
  const list = useIPTVStore((s) => s.activeList);
  const isFavorite = useIPTVStore((s) => s.favorites.includes(channel.id));
  const { toggleFavorite, addRecent, playChannel, playNext, playPrev, playLast, closePlayer, setPlayerPrefs } =
    useIPTVStore.getState();

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // URL que se está probando de `channel.sources`. Va ligada al canal para volver a la primera al cambiar de canal.
  const [attempt, setAttempt] = useState({ id: channel.id, index: 0 });
  const sourceIndex = attempt.id === channel.id ? attempt.index : 0;
  const streamUrl = channel.sources[sourceIndex] ?? channel.url;
  const hasNextSource = sourceIndex < channel.sources.length - 1;

  const hls = useHls(videoRef, streamUrl);
  // Hasta que el hook procesa la URL nueva, su estado aún es el de la anterior.
  const current = hls.url === streamUrl;
  // Si esta URL falla y quedan otras, no se muestra el error: se pasa a la siguiente (efecto de abajo).
  const status = !current || (hls.status === 'error' && hasNextSource) ? 'loading' : hls.status;
  const { error } = hls;

  useEffect(() => {
    if (current && hls.status === 'error' && hasNextSource) setAttempt({ id: channel.id, index: sourceIndex + 1 });
  }, [current, hls.status, hasNextSource, channel.id, sourceIndex]);

  /** Tras fallar todas, "Reintentar" vuelve a empezar por la primera URL. */
  const retry = () => (sourceIndex === 0 ? hls.retry() : setAttempt({ id: channel.id, index: 0 }));

  const [paused, setPaused] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [canPlay, setCanPlay] = useState(false);
  const [audio, setAudio] = useState(() => {
    const { volume, muted } = useIPTVStore.getState();
    return { volume, muted };
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  // Panel lateral abierto: la lista de canales o la programación del canal.
  const [panel, setPanel] = useState<'channels' | 'guide' | null>(null);
  const panelOpen = panel !== null;
  const hasGuide = (useChannelPrograms(channel)?.length ?? 0) > 0;
  const preferredHeight = useIPTVStore((s) => s.preferredHeight);
  // Imagen en imagen: el vídeo sigue en una ventana flotante y la pantalla del reproductor se oculta.
  const pip = useUIStore((s) => s.pip);
  const pipSupported = document.pictureInPictureEnabled;
  // Táctil: tocar el vídeo muestra u oculta los controles (con ratón, pausa) y se puede deslizar.
  const [touch] = useState(() => window.matchMedia('(pointer: coarse)').matches);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const position = list.findIndex((c) => c.id === channel.id) + 1;
  const hasSiblings = list.length > 1;

  // Estado del <video>: se aplican las preferencias guardadas y se escuchan sus eventos.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const { volume, muted } = useIPTVStore.getState();
    video.volume = volume;
    video.muted = muted;

    const sync = () => {
      setPaused(video.paused);
      setAudio({ volume: video.volume, muted: video.muted });
    };
    const onWaiting = () => setBuffering(true);
    const onReady = () => {
      setBuffering(false);
      setCanPlay(true);
    };
    const events: [keyof HTMLMediaElementEventMap, () => void][] = [
      ['play', sync],
      ['pause', sync],
      ['volumechange', sync],
      ['waiting', onWaiting],
      ['canplay', onReady],
      ['playing', onReady],
    ];
    events.forEach(([name, fn]) => video.addEventListener(name, fn));
    return () => events.forEach(([name, fn]) => video.removeEventListener(name, fn));
  }, []);

  useEffect(() => {
    setCanPlay(false);
    setBuffering(false);
  }, [streamUrl]);

  // El estado se guarda por `id`, que no siempre es la URL que se reproduce (fuentes con proxy o
  // alternativas). Caído solo cuando han fallado todas sus URLs.
  useEffect(() => {
    if (!current) return;
    if (hls.status === 'playing') {
      reportPlayback(channel.id, 'online');
      addRecent(channel.id); // solo cuenta lo que llega a reproducirse
    }
    else if (hls.status === 'error' && !hasNextSource) reportPlayback(channel.id, 'offline');
  }, [current, hls.status, hasNextSource, channel.id]);

  // Bloquea el scroll de la página mientras el reproductor está abierto (no si está en ventana flotante).
  useEffect(() => {
    if (pip) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [pip]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), HIDE_CONTROLS_MS);
  }, []);

  useEffect(() => {
    revealControls();
    return () => clearTimeout(hideTimer.current);
  }, [revealControls, channel.id]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, []);

  const setVolume = useCallback(
    (value: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.volume = Math.min(1, Math.max(0, value));
      video.muted = video.volume === 0;
      setPlayerPrefs({ volume: video.volume, muted: video.muted });
    },
    [setPlayerPrefs],
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) video.volume = 0.5;
    setPlayerPrefs({ volume: video.volume, muted: video.muted });
  }, [setPlayerPrefs]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (document.fullscreenEnabled) {
      containerRef.current?.requestFullscreen().then(lockLandscape, () => {});
    } else {
      // iPhone: no hay pantalla completa de elementos, solo la del propio vídeo.
      const video: (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null = videoRef.current;
      video?.webkitEnterFullscreen?.();
    }
  }, []);

  const close = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    closePlayer();
  }, [closePlayer]);

  // Al abrir, el foco pasa al reproductor (si no, queda en la tarjeta de debajo y Espacio/Enter la
  // activarían otra vez) y al cerrar vuelve a la tarjeta, para seguir navegando con el teclado.
  useEffect(() => {
    const opener = document.activeElement;
    containerRef.current?.focus({ preventScroll: true });
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  const number = useChannelNumber(list, playChannel);

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (document.pictureInPictureEnabled) await video.requestPictureInPicture();
    } catch {
      // Aún sin imagen (el canal no ha arrancado) o el navegador lo rechaza: se queda como estaba.
    }
  }, []);

  // El vídeo entra y sale de la ventana flotante; el estado vive en `useUIStore` para el resto de la app.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const setPip = useUIStore.getState().setPip;
    const enter = () => setPip(true);
    const leave = () => setPip(false);
    video.addEventListener('enterpictureinpicture', enter);
    video.addEventListener('leavepictureinpicture', leave);
    return () => {
      video.removeEventListener('enterpictureinpicture', enter);
      video.removeEventListener('leavepictureinpicture', leave);
      if (document.pictureInPictureElement === video) void document.exitPictureInPicture().catch(() => {});
      setPip(false);
    };
  }, []);

  // Atajos de teclado
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = e.target instanceof HTMLElement ? e.target.tagName : '';
      if ((tag === 'INPUT' || tag === 'TEXTAREA') && e.key !== 'Escape') return;
      if (e.key === ' ' && tag === 'BUTTON') return; // el propio botón ya se activa con espacio
      if (useUIStore.getState().pip) return; // con el reproductor flotante, las teclas son de la pantalla de debajo

      if (/^\d$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        number.pressDigit(e.key);
        revealControls();
        return;
      }
      if (e.key === 'Enter' && number.hasPending()) {
        e.preventDefault();
        number.commit();
        return;
      }

      switch (e.key) {
        case 'Escape':
          if (panelOpen) setPanel(null);
          else close();
          break;
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
          toggleMute();
          break;
        case 'p':
        case 'P':
          void togglePip();
          break;
        case 'g':
        case 'G':
          if (hasGuide) setPanel((p) => (p === 'guide' ? null : 'guide'));
          break;
        case 'ArrowRight':
          playNext();
          break;
        case 'ArrowLeft':
          playPrev();
          break;
        case 'PageDown':
        case 'ArrowDown':
          e.preventDefault();
          if (e.shiftKey && e.key === 'ArrowDown') setVolume((videoRef.current?.volume ?? 1) - 0.1);
          else playNext();
          break;
        case 'PageUp':
        case 'ArrowUp':
          e.preventDefault();
          if (e.shiftKey && e.key === 'ArrowUp') setVolume((videoRef.current?.volume ?? 1) + 0.1);
          else playPrev();
          break;
        case '+':
        case '=':
          setVolume((videoRef.current?.volume ?? 1) + 0.1);
          break;
        case '-':
          setVolume((videoRef.current?.volume ?? 1) - 0.1);
          break;
        case 'Backspace':
          e.preventDefault();
          playLast();
          break;
        default:
          return;
      }
      revealControls();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panelOpen, close, togglePlay, toggleFullscreen, toggleMute, playNext, playPrev, playLast, setVolume, revealControls, number, togglePip, hasGuide]);

  const hasError = status === 'error';
  // Canales que solo se ven en la web de su cadena (ver `lib/officialLive.ts`).
  const official = officialLive(channel);
  const showSpinner = !hasError && (buffering || (status === 'loading' && !canPlay));
  const showControls = controlsVisible || paused || hasError || panelOpen;
  // Con ratón, un botón grande solo en pausa; en táctil, anterior/reproducir/siguiente con los controles.
  const showCenter = !hasError && !showSpinner && (touch ? showControls : paused);

  const onVideoClick = () => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    if (!touch) togglePlay();
    else if (showControls && !paused) {
      clearTimeout(hideTimer.current);
      setControlsVisible(false);
    } else revealControls();
  };

  return (
    <>
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Reproduciendo ${channel.name}`}
      tabIndex={-1}
      onPointerMove={(e) => e.pointerType === 'mouse' && revealControls()}
      onPointerDown={(e) => e.target !== videoRef.current && revealControls()}
      className={`fixed inset-0 z-50 flex bg-black text-white select-none focus:outline-none ${showControls ? '' : 'cursor-none'} ${pip ? 'invisible pointer-events-none' : ''}`}
    >
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          onClick={onVideoClick}
          onDoubleClick={touch ? undefined : toggleFullscreen}
          onTouchStart={(e) => {
            const t = e.touches[0];
            swipeStart.current = t && e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
          }}
          onTouchEnd={(e) => {
            const start = swipeStart.current;
            const t = e.changedTouches[0];
            swipeStart.current = null;
            if (!start || !t || !hasSiblings) return;
            const dx = t.clientX - start.x;
            if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(t.clientY - start.y) * 1.5) return;
            swiped.current = true;
            if (dx < 0) playNext();
            else playPrev();
          }}
          className="h-full w-full object-contain"
        />

        {showSpinner && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <LoaderCircle className="h-16 w-16 animate-spin text-brand" aria-label="Cargando canal" />
          </div>
        )}

        {number.entry && (
          <div
            role="status"
            className="pointer-events-none absolute top-[max(1.5rem,env(safe-area-inset-top))] right-[max(1.5rem,env(safe-area-inset-right))] z-10 max-w-[70%] rounded-lg bg-black/75 px-4 py-2 text-right backdrop-blur-sm"
          >
            <p className="text-5xl font-black tracking-wider tabular-nums">{number.entry.text}</p>
            <p className="truncate text-sm text-neutral-300">
              {number.entry.target ? number.entry.target.name : 'No existe ese canal'}
            </p>
          </div>
        )}

        {showCenter && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-10">
            {touch && hasSiblings && (
              <CenterButton onClick={playPrev} label="Canal anterior" size="small">
                <SkipBack className="h-7 w-7 fill-current" />
              </CenterButton>
            )}
            <CenterButton onClick={togglePlay} label={paused ? 'Reproducir' : 'Pausar'} size="large">
              {paused ? <Play className="h-9 w-9 translate-x-0.5 fill-current" /> : <Pause className="h-9 w-9 fill-current" />}
            </CenterButton>
            {touch && hasSiblings && (
              <CenterButton onClick={playNext} label="Canal siguiente" size="small">
                <SkipForward className="h-7 w-7 fill-current" />
              </CenterButton>
            )}
          </div>
        )}

        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6" role="alert">
            <div className="max-w-md text-center">
              <TriangleAlert className="mx-auto mb-4 h-14 w-14 text-brand" />
              <h2 className="text-xl font-bold">No se puede reproducir «{channel.name}»</h2>
              <p className="mt-2 text-neutral-300">
                {official
                  ? `${channel.name} no ofrece una emisión abierta que se pueda reproducir aquí: solo se ve en ${official.service}.`
                  : error}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {official && (
                  <a
                    href={official.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md bg-white px-5 py-2 font-semibold text-black hover:bg-white/80"
                  >
                    Ver en {official.service}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={retry}
                  className="flex items-center gap-2 rounded-md bg-white px-5 py-2 font-semibold text-black hover:bg-white/80"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reintentar
                </button>
                {hasSiblings && (
                  <button
                    type="button"
                    onClick={playNext}
                    className="flex items-center gap-2 rounded-md bg-neutral-700 px-5 py-2 font-semibold hover:bg-neutral-600"
                  >
                    Siguiente canal
                    <SkipForward className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Barra superior */}
        <div
          className={`absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/90 to-transparent pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-12 pl-[max(1rem,env(safe-area-inset-left))] transition-opacity duration-300 md:gap-4 md:px-8 ${
            showControls ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <ControlButton onClick={close} label="Cerrar reproductor (Esc)">
            <X className="h-7 w-7" />
          </ControlButton>
          <div className="hidden shrink-0 sm:block">
            <ChannelLogo channel={channel} className="h-10 w-16" textClassName="text-sm" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{channel.name}</p>
            <p className="truncate text-sm text-neutral-400">
              {[...channel.groups, ...badgeLabels(channel.badges)].join(' · ')}
              {channel.sources.length > 1 && ` · Fuente ${sourceIndex + 1} de ${channel.sources.length}`}
            </p>
            <NowNextText channel={channel} />
          </div>
          <span className="ml-auto hidden shrink-0 items-center gap-1.5 rounded bg-brand px-2 py-0.5 text-xs font-bold tracking-wider uppercase sm:flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Directo
          </span>
          <ControlButton
            onClick={() => toggleFavorite(channel.id)}
            label={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            pressed={isFavorite}
            className="ml-auto sm:ml-0"
          >
            <Heart className={`h-6 w-6 ${isFavorite ? 'fill-brand text-brand' : ''}`} />
          </ControlButton>
        </div>

        {/* Controles inferiores */}
        <div
          className={`absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/90 to-transparent pt-16 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] transition-opacity duration-300 md:gap-4 md:px-8 ${
            showControls ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <ControlButton
            onClick={togglePlay}
            label={paused ? 'Reproducir (espacio)' : 'Pausar (espacio)'}
            disabled={hasError}
            className="pointer-coarse:hidden"
          >
            {paused ? <Play className="h-7 w-7 fill-current" /> : <Pause className="h-7 w-7 fill-current" />}
          </ControlButton>
          {hasSiblings && (
            <>
              <ControlButton onClick={playPrev} label="Canal anterior (←)" className="pointer-coarse:hidden">
                <SkipBack className="h-6 w-6" />
              </ControlButton>
              <ControlButton onClick={playNext} label="Canal siguiente (→)" className="pointer-coarse:hidden">
                <SkipForward className="h-6 w-6" />
              </ControlButton>
            </>
          )}

          <div className="group/vol flex items-center gap-2">
            <ControlButton onClick={toggleMute} label={audio.muted ? 'Activar sonido (M)' : 'Silenciar (M)'}>
              {audio.muted || audio.volume === 0 ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
            </ControlButton>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={audio.muted ? 0 : audio.volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volumen"
              className="hidden w-24 accent-brand sm:block"
            />
          </div>

          {hasSiblings && (
            <span className="text-sm text-neutral-400 tabular-nums">
              {position} / {list.length}
            </span>
          )}

          <div className="ml-auto flex items-center gap-2 md:gap-4">
            {hasGuide && (
              <ControlButton
                onClick={() => setPanel((p) => (p === 'guide' ? null : 'guide'))}
                label="Programación (G)"
                pressed={panel === 'guide'}
              >
                <CalendarClock className="h-6 w-6" />
              </ControlButton>
            )}
            {hasSiblings && (
              <ControlButton
                onClick={() => setPanel((p) => (p === 'channels' ? null : 'channels'))}
                label="Lista de canales"
                pressed={panel === 'channels'}
              >
                <List className="h-6 w-6" />
              </ControlButton>
            )}
            <QualityMenu
              levels={hls.levels}
              activeLevel={hls.activeLevel}
              preferredHeight={preferredHeight}
              onSelect={hls.setQuality}
            />
            {pipSupported && (
              <ControlButton onClick={() => void togglePip()} label="Ventana flotante (P)" disabled={hasError}>
                <PictureInPicture2 className="h-6 w-6" />
              </ControlButton>
            )}
            <ControlButton onClick={toggleFullscreen} label={isFullscreen ? 'Salir de pantalla completa (F)' : 'Pantalla completa (F)'}>
              {isFullscreen ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
            </ControlButton>
          </div>
        </div>
      </div>

      {panel === 'channels' && (
        <ChannelPanel
          list={list}
          activeId={channel.id}
          onSelect={(c) => playChannel(c, list)}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'guide' && <GuidePanel channel={channel} onClose={() => setPanel(null)} />}
    </div>

    {pip && (
      <div className="fixed right-4 bottom-[calc(var(--bottom-nav-h)+1rem)] z-50 flex items-center gap-3 rounded-full bg-neutral-900/95 py-2 pr-2 pl-4 text-sm shadow-2xl ring-1 ring-white/15 backdrop-blur">
        <span className="max-w-40 truncate font-semibold">{channel.name}</span>
        <button
          type="button"
          onClick={() => void togglePip()}
          className="rounded-full bg-white px-3 py-1.5 font-semibold text-black hover:bg-white/80"
        >
          Ampliar
        </button>
        <button type="button" onClick={close} aria-label="Cerrar reproductor" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>
    )}
    </>
  );
}

type ControlButtonProps = {
  onClick: () => void;
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

function ControlButton({ onClick, label, pressed, disabled, className = '', children }: ControlButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:scale-110 hover:bg-white/10 active:bg-white/15 disabled:opacity-40 disabled:hover:scale-100 md:h-10 md:w-10 ${className}`}
    >
      {children}
    </button>
  );
}

type CenterButtonProps = {
  onClick: () => void;
  label: string;
  size: 'small' | 'large';
  children: ReactNode;
};

function CenterButton({ onClick, label, size, children }: CenterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`pointer-events-auto flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition hover:scale-110 hover:bg-black/70 active:scale-90 ${
        size === 'large' ? 'h-20 w-20 ring-2 ring-white/70' : 'h-14 w-14'
      }`}
    >
      {children}
    </button>
  );
}

type ChannelPanelProps = {
  list: Channel[];
  activeId: string;
  onSelect: (channel: Channel) => void;
  onClose: () => void;
};

function ChannelPanel({ list, activeId, onSelect, onClose }: ChannelPanelProps) {
  const [query, setQuery] = useState('');
  const activeRef = useRef<HTMLButtonElement>(null);
  const statuses = useStreamStatus((s) => s.statuses);
  const filtered = useMemo(() => filterChannels(list, query), [list, query]);
  const shown = filtered.slice(0, PANEL_MAX_ITEMS);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <aside
      aria-label="Selector de canales"
      className="absolute inset-y-0 right-0 z-10 flex w-full max-w-xs flex-col border-l border-white/10 bg-neutral-950/95 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] backdrop-blur md:relative"
    >
      <div className="flex items-center gap-2 border-b border-white/10 p-3">
        <Search className="h-4 w-4 shrink-0 text-neutral-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en la lista…"
          aria-label="Buscar en la lista de canales"
          className="min-w-0 flex-1 bg-transparent text-base focus:outline-none md:text-sm"
        />
        <button type="button" onClick={onClose} aria-label="Cerrar lista" className="text-neutral-400 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto py-1">
        {shown.map((c) => {
          const active = c.id === activeId;
          const offline = statuses[c.id]?.status === 'offline';
          return (
            <li key={c.id}>
              <button
                ref={active ? activeRef : undefined}
                type="button"
                onClick={() => onSelect(c)}
                aria-current={active}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition md:py-2 ${
                  active ? 'bg-brand/20 font-semibold text-white' : 'text-neutral-300 hover:bg-white/5'
                } ${offline && !active ? 'opacity-45' : ''}`}
              >
                <ChannelLogo
                  channel={c}
                  className={`h-8 w-12 shrink-0 ${offline ? 'grayscale' : ''}`}
                  textClassName="text-xs"
                />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {offline && <span className="shrink-0 text-[10px] text-neutral-500 uppercase">No disponible</span>}
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-neutral-500">Sin resultados</li>}
        {filtered.length > PANEL_MAX_ITEMS && (
          <li className="px-3 py-3 text-center text-xs text-neutral-500">
            Mostrando {PANEL_MAX_ITEMS} de {filtered.length}. Usa el buscador.
          </li>
        )}
      </ul>
    </aside>
  );
}
