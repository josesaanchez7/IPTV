import { GUIDE_FETCH_TIMEOUT_MS, GUIDE_HORIZON_S } from '../config';
import type { Channel } from '../types';
import { tvgKey } from './playlist';

/**
 * Guía de programación: qué emite cada canal ahora y después. Viene de dos sitios:
 * - la guía XMLTV de TDTChannels (título, sinopsis y hora de fin), que se enlaza por `tvg-id`;
 * - los datos de Samsung TV Plus y Plex ya descargados con sus canales (solo hora de inicio y
 *   título: el fin de cada programa es el inicio del siguiente).
 */

export type Program = {
  /** Segundos desde 1970 (como `Date.now() / 1000`). */
  start: number;
  end: number;
  title: string;
  description: string | null;
};

/** El último programa de Samsung/Plex no trae fin: se da por el siguiente hueco de una hora. */
const UNKNOWN_END_S = 60 * 60;

const text = (value: unknown) => (typeof value === 'string' ? value : '');

/**
 * Programas de los datos de Samsung/Plex: `[[inicio, título], …]` en orden. Descarta lo que no
 * tiene la forma esperada (es un JSON de terceros).
 */
export function programsFromStarts(entries: unknown): Program[] {
  if (!Array.isArray(entries)) return [];
  const starts: { start: number; title: string }[] = [];
  for (const entry of entries) {
    if (!Array.isArray(entry)) continue;
    const start = Number(entry[0]);
    const title = text(entry[1]).trim();
    if (Number.isFinite(start) && title) starts.push({ start, title });
  }
  starts.sort((a, b) => a.start - b.start);
  return starts.map((p, i) => ({
    start: p.start,
    end: starts[i + 1]?.start ?? p.start + UNKNOWN_END_S,
    title: p.title,
    description: null,
  }));
}

/** "20261009055000 +0200" → segundos desde 1970. El desfase es opcional (sin él, UTC). */
export function parseXmltvTime(value: string): number | null {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second, sign, offsetH, offsetM] = match;
  const utc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  const offset = sign ? (sign === '-' ? -1 : 1) * (Number(offsetH) * 60 + Number(offsetM)) * 60 : 0;
  return utc / 1000 - offset;
}

/** Clave de un canal de la guía XMLTV (su `id`), comparable con el `tvg-id` de cualquier lista. */
export const xmltvKey = (id: string) => (tvgKey(id) ? `tvg:${tvgKey(id)}` : null);

/**
 * Programas de un XMLTV por canal. Solo se quedan los que no han terminado hace más de una hora
 * y empiezan dentro de `GUIDE_HORIZON_S`: el archivo trae mucho más de lo que se va a mirar.
 */
export function parseXmltv(xml: string, nowSeconds: number): Map<string, Program[]> {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const byChannel = new Map<string, Program[]>();
  for (const node of Array.from(doc.getElementsByTagName('programme'))) {
    const key = xmltvKey(node.getAttribute('channel') ?? '');
    const start = parseXmltvTime(node.getAttribute('start') ?? '');
    const end = parseXmltvTime(node.getAttribute('stop') ?? '');
    const title = node.getElementsByTagName('title')[0]?.textContent?.trim();
    if (!key || start === null || end === null || !title) continue;
    if (end < nowSeconds - 3600 || start > nowSeconds + GUIDE_HORIZON_S) continue;

    const description = node.getElementsByTagName('desc')[0]?.textContent?.trim() || null;
    const list = byChannel.get(key);
    const program = { start, end, title, description };
    if (list) list.push(program);
    else byChannel.set(key, [program]);
  }
  for (const list of byChannel.values()) list.sort((a, b) => a.start - b.start);
  return byChannel;
}

/** Descarga, descomprime (.gz) y analiza la guía XMLTV de `url`. */
export async function fetchXmltvGuide(url: string, signal?: AbortSignal): Promise<Map<string, Program[]>> {
  const timeout = AbortSignal.timeout(GUIDE_FETCH_TIMEOUT_MS);
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok || !response.body) throw new Error(`La guía respondió ${response.status}.`);
  const stream = /\.gz($|\?)/i.test(url) ? response.body.pipeThrough(new DecompressionStream('gzip')) : response.body;
  const xml = await new Response(stream).text();
  return parseXmltv(xml, Date.now() / 1000);
}

/** Dónde buscar los programas de `channel`, por orden: su `tvg-id`, su `id` y las URLs de sus fuentes. */
export function guideKeys(channel: Channel): string[] {
  const tvg = channel.tvgId ? xmltvKey(channel.tvgId) : null;
  return [...(tvg ? [tvg] : []), channel.id, ...channel.sources];
}

export type NowNext = {
  now: Program | null;
  next: Program | null;
  /** 0-1: cuánto lleva emitido `now`. */
  progress: number;
};

/** El programa que está emitiéndose a `nowSeconds` y el siguiente. */
export function nowAndNext(programs: Program[] | undefined, nowSeconds: number): NowNext {
  if (!programs?.length) return { now: null, next: null, progress: 0 };
  const index = programs.findIndex((p) => p.start <= nowSeconds && nowSeconds < p.end);
  if (index === -1) {
    // Hueco entre programas: no hay "ahora", pero sí un "después".
    return { now: null, next: programs.find((p) => p.start > nowSeconds) ?? null, progress: 0 };
  }
  const now = programs[index] ?? null;
  const progress = now ? (nowSeconds - now.start) / Math.max(1, now.end - now.start) : 0;
  return { now, next: programs[index + 1] ?? null, progress };
}

/** "16:05" en la hora local del usuario. */
export const formatClock = (seconds: number) =>
  new Date(seconds * 1000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
