import type { StreamStatus } from '../types';

const CHECK_TIMEOUT_MS = 10000;
const MAX_PLAYLIST_BYTES = 64 * 1024;

/** Un stream http:// en una página https:// lo bloquea siempre el navegador. */
export const isMixedContent = (url: string) => window.location.protocol === 'https:' && url.startsWith('http:');

async function readHead(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  while (bytes < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    text += decoder.decode(value, { stream: true });
  }
  reader.cancel().catch(() => {});
  return text;
}

/**
 * Pide `url` igual que lo haría HLS.js (fetch con CORS desde este navegador).
 * `text` queda undefined si la respuesta es un stream de vídeo/audio directo.
 */
type ProbeResult = { ok: false } | { ok: true; finalUrl: string; text?: string };

async function probe(url: string, signal: AbortSignal): Promise<ProbeResult> {
  const response = await fetch(url, { signal, cache: 'no-store' });
  if (!response.ok) return { ok: false };
  const type = response.headers.get('content-type') ?? '';
  if (/^(video|audio)\//i.test(type) && !/mpegurl/i.test(type)) {
    response.body?.cancel().catch(() => {});
    return { ok: true, finalUrl: response.url };
  }
  return { ok: true, finalUrl: response.url, text: await readHead(response, MAX_PLAYLIST_BYTES) };
}

const isPlaylist = (text: string) => text.trimStart().startsWith('#EXTM3U');

/** En una lista maestra, URL absoluta de la primera variante (#EXT-X-STREAM-INF). */
function firstVariantUrl(text: string, baseUrl: string): string | null {
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((l) => l.startsWith('#EXT-X-STREAM-INF'));
  if (index === -1) return null;
  const uri = lines.slice(index + 1).find((l) => l.trim() && !l.startsWith('#'));
  try {
    return uri ? new URL(uri.trim(), baseUrl).href : null;
  } catch {
    return null;
  }
}

/**
 * Comprueba si el canal es accesible desde el navegador sin abrir el reproductor:
 * manifiesto + primera variante. No descarga segmentos, así que un canal "online"
 * aún puede fallar al reproducir (p. ej. segmentos geobloqueados), pero los
 * errores de CORS, 403/404 y servidores caídos se detectan antes.
 *
 */
/** URLs de un mismo canal que se prueban como mucho, para no atascar la cola de comprobaciones. */
const MAX_SOURCES_CHECKED = 3;

/** Un canal con varias URLs (`Channel.sources`) está disponible si lo está alguna; se prueban en orden. */
export async function checkSources(urls: string[]): Promise<StreamStatus> {
  for (const url of urls.slice(0, MAX_SOURCES_CHECKED)) {
    if ((await checkStream(url)) === 'online') return 'online';
  }
  return 'offline';
}

export async function checkStream(url: string): Promise<StreamStatus> {
  if (isMixedContent(url)) return 'offline';
  const signal = AbortSignal.timeout(CHECK_TIMEOUT_MS);
  try {
    const manifest = await probe(url, signal);
    if (!manifest.ok) return 'offline';
    if (manifest.text === undefined) return 'online';
    if (!isPlaylist(manifest.text)) return 'offline';

    const variant = firstVariantUrl(manifest.text, manifest.finalUrl || url);
    if (!variant) return 'online';
    const level = await probe(variant, signal);
    return level.ok && (level.text === undefined || isPlaylist(level.text)) ? 'online' : 'offline';
  } catch {
    return 'offline';
  }
}
