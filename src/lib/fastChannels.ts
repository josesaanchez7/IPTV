import { JMP2_PROXY, SOURCE_FETCH_TIMEOUT_MS, type ChannelSource } from '../config';
import type { Channel } from '../types';
import { programsFromStarts, type Program } from './guide';
import { createChannel } from './playlist';

/** Programas por clave (la `id` y la `url` del canal, que pueden diferir), para `useGuide`. */
type GuideEntries = [string, Program[]][];

function guideFor(channel: Channel, raw: unknown): GuideEntries {
  const programs = programsFromStarts(field(raw, 'programs'));
  return programs.length ? [[channel.id, programs], [channel.url, programs]] : [];
}

/**
 * Canales de Samsung TV Plus y Plex (España) a partir de los datos que i.mjh.nz publica en GitHub
 * (`.channels.json.gz`). Sus listas M3U en i.mjh.nz las bloquean algunas operadoras españolas por
 * orden judicial; GitHub no, y permite descargar desde el navegador.
 */

const REGION = 'es';
const PLEX_PARTS = 'https://epg.provider.plex.tv/library/parts';

/** Lee `key` de un objeto JSON sin fiarse de su forma. */
const field = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;

const entries = (value: unknown): [string, unknown][] =>
  typeof value === 'object' && value !== null ? Object.entries(value) : [];

const text = (value: unknown) => (typeof value === 'string' ? value : '');

async function fetchGzipJson(url: string, signal: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(SOURCE_FETCH_TIMEOUT_MS);
  const combined = AbortSignal.any([signal, timeout]);
  let response: Response;
  try {
    response = await fetch(url, { signal: combined });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new Error(timeout.aborted ? 'No respondió a tiempo.' : 'No se pudieron descargar los datos de los canales.');
  }
  if (!response.ok || !response.body) {
    throw new Error(`El servidor respondió ${response.status} al descargar los datos de los canales.`);
  }
  try {
    return await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
  } catch (err) {
    if (signal.aborted) throw err;
    throw new Error('Los datos de los canales no tienen el formato esperado.');
  }
}

/**
 * Samsung TV Plus: cada canal se pide a `jmp2.uk/stvp-<id>`, que redirige al CDN. Esa
 * redirección no permite CORS, así que se reproduce a través del proxy de Vite; el `id` sigue
 * siendo la URL real, para que favoritos y caché no dependan del proxy. Los que llevan DRM
 * (`license_url`) se descartan: el navegador no los puede reproducir con hls.js.
 */
function samsungChannels(data: unknown, guide: GuideEntries): Channel[] {
  const channels = field(field(field(data, 'regions'), REGION), 'channels');
  return entries(channels)
    .filter(([, channel]) => !field(channel, 'license_url'))
    .map(([id, raw]) => {
      const channel = createChannel({
        id: `https://jmp2.uk/stvp-${id}`,
        url: `${window.location.origin}${JMP2_PROXY}/stvp-${id}`,
        name: text(field(raw, 'name')),
        logo: text(field(raw, 'logo')),
        group: text(field(raw, 'group')),
      });
      guide.push(...guideFor(channel, raw));
      return channel;
    });
}

/**
 * Plex: el stream está en su servidor y permite CORS, pero pide la credencial pública que viene
 * en los mismos datos (`headers['X-Plex-Token']`); se lee de ahí para no fijarla en el código.
 * Plex no da categorías: salen del nombre del canal.
 */
function plexChannels(data: unknown, guide: GuideEntries): Channel[] {
  const token = text(field(field(data, 'headers'), 'X-Plex-Token'));
  if (!token) throw new Error('Faltan datos para reproducir los canales de Plex.');
  return entries(field(data, 'channels'))
    .filter(([, channel]) => {
      const regions = field(channel, 'regions');
      return Array.isArray(regions) && regions.includes(REGION);
    })
    .map(([id, raw]) => {
      const stream = `${PLEX_PARTS}/${id}.m3u8`;
      const channel = createChannel({
        id: stream,
        url: `${stream}?X-Plex-Token=${encodeURIComponent(token)}`,
        name: text(field(raw, 'name')),
        logo: text(field(raw, 'logo')),
      });
      guide.push(...guideFor(channel, raw));
      return channel;
    });
}

/** `onGuide` recibe la programación que traen los mismos datos (ver `useGuide`). */
export async function loadFastChannels(
  source: ChannelSource,
  signal: AbortSignal,
  onGuide: (entries: GuideEntries) => void,
): Promise<Channel[]> {
  const data = await fetchGzipJson(source.url, signal);
  const guide: GuideEntries = [];
  const channels = source.kind === 'plex' ? plexChannels(data, guide) : samsungChannels(data, guide);
  onGuide(guide);
  if (!channels.length) throw new Error('No se encontraron canales de España.');
  return channels;
}
