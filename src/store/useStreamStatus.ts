import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { checkSources } from '../lib/streamCheck';
import type { Channel, StreamStatus } from '../types';

const STATUS_TTL_MS = 30 * 60 * 1000;
const CONCURRENCY = 6;
const PERSIST_THROTTLE_MS = 1500;

type StatusEntry = { status: StreamStatus; checkedAt: number };
type Statuses = Record<string, StatusEntry>;

type StreamStatusState = {
  statuses: Statuses;
  setStatus: (id: string, status: StreamStatus) => void;
};

const isFresh = (entry: StatusEntry | undefined) => !!entry && Date.now() - entry.checkedAt < STATUS_TTL_MS;

function pruneExpired(statuses: Statuses = {}): Statuses {
  return Object.fromEntries(Object.entries(statuses).filter(([, entry]) => isFresh(entry)));
}

/**
 * localStorage con escritura limitada a una cada PERSIST_THROTTLE_MS: los resultados llegan
 * de uno en uno y en ráfaga, y serializar el mapa entero en cada uno sería un desperdicio.
 * Lo pendiente se vuelca al cerrar u ocultar la página.
 */
const throttledLocalStorage: StateStorage = (() => {
  const pending = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    for (const [name, value] of pending) {
      try {
        localStorage.setItem(name, value);
      } catch {
        // Sin espacio o almacenamiento bloqueado: la caché es solo una optimización.
      }
    }
    pending.clear();
  };

  window.addEventListener('pagehide', flush);

  return {
    getItem: (name) => {
      try {
        return localStorage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      pending.set(name, value);
      timer ??= setTimeout(flush, PERSIST_THROTTLE_MS);
    },
    removeItem: (name) => {
      try {
        localStorage.removeItem(name);
      } catch {
        // idem
      }
    },
  };
})();

/** Disponibilidad de cada canal, por id. */
export const useStreamStatus = create<StreamStatusState>()(
  persist(
    (set) => ({
      statuses: {},
      setStatus: (id, status) =>
        set((state) => ({ statuses: { ...state.statuses, [id]: { status, checkedAt: Date.now() } } })),
    }),
    {
      name: 'iptv-stream-status',
      version: 1,
      storage: createJSONStorage(() => throttledLocalStorage),
      partialize: (state) => ({ statuses: state.statuses }),
      merge: (persisted, current) => ({
        ...current,
        statuses: pruneExpired((persisted as Partial<StreamStatusState> | undefined)?.statuses),
      }),
    },
  ),
);

export const isKnownOffline = (id: string) => useStreamStatus.getState().statuses[id]?.status === 'offline';

// Cola de comprobaciones: solo se comprueban las tarjetas montadas, como mucho CONCURRENCY a la vez
// y una por servidor. Fuentes como Plex sirven todos sus canales desde el mismo servidor y
// responden 429 (demasiadas peticiones) a una ráfaga, lo que marcaría canales buenos como caídos.
const queue: Channel[] = [];
const queued = new Set<string>();
const busyHosts = new Set<string>();
let running = 0;

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

function pump() {
  while (running < CONCURRENCY) {
    const index = queue.findIndex((c) => !busyHosts.has(hostOf(c.url)));
    if (index === -1) return;
    const [channel] = queue.splice(index, 1);
    if (!channel) return;
    const host = hostOf(channel.url);
    running++;
    busyHosts.add(host);
    void checkSources(channel.sources) // nunca rechaza: cualquier fallo es 'offline'
      .then((status) => useStreamStatus.getState().setStatus(channel.id, status))
      .finally(() => {
        running--;
        busyHosts.delete(host);
        queued.delete(channel.id);
        pump();
      });
  }
}

export function requestCheck(channel: Channel) {
  if (queued.has(channel.id) || isFresh(useStreamStatus.getState().statuses[channel.id])) return;
  queued.add(channel.id);
  queue.push(channel);
  pump();
}

/** Saca de la cola un canal que ya no está en pantalla (si aún no se estaba comprobando). */
export function cancelCheck(channel: Channel) {
  const index = queue.findIndex((c) => c.id === channel.id);
  if (index === -1) return;
  queue.splice(index, 1);
  queued.delete(channel.id);
}

/** Lo que pasa al reproducir de verdad prevalece sobre la comprobación previa. */
export function reportPlayback(id: string, status: StreamStatus) {
  useStreamStatus.getState().setStatus(id, status);
}
