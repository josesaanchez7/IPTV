import { create, type StoreApi } from 'zustand';
import { persist } from 'zustand/middleware';
import { RECENTS_LIMIT, SPANISH_SOURCES } from '../config';
import { loadFastChannels } from '../lib/fastChannels';
import {
  applyHidden,
  fetchPlaylistText,
  fetchSourceText,
  groupByCategory,
  inheritCategories,
  mergeChannels,
  parsePlaylist,
  readPlaylistFile,
} from '../lib/playlist';
import type {
  Category,
  Channel,
  HiddenGroups,
  LoadOptions,
  LoadResult,
  LoadStatus,
  Notice,
  PlaylistSource,
  SourceFilter,
  SourceId,
  SourceState,
} from '../types';
import { loadGuide, useGuide } from './useGuide';
import { isKnownOffline } from './useStreamStatus';

type PlayerPrefs = { volume: number; muted: boolean };

export type IPTVState = PlayerPrefs & {
  // Lista M3U
  playlistSource: PlaylistSource | null;
  /** Se incrementa con cada lista cargada; sirve de `key` para reiniciar filas y vistas. */
  playlistVersion: number;
  status: LoadStatus;
  isLoading: boolean;
  error: string | null;
  notice: Notice | null;

  // Canales
  /** Fuentes españolas por separado; vacío cuando hay cargada una lista suelta. */
  sources: Partial<Record<SourceId, SourceState>>;
  sourceFilter: SourceFilter;
  /** Canales de `sourceFilter` sin duplicados, antes de quitar lo oculto (para el menú de categorías). */
  baseChannels: Channel[];
  /** Canales que se ven: `baseChannels` sin las categorías y comunidades ocultas. */
  channels: Channel[];
  categories: Category[];
  /** Todos los canales cargados de cualquier fuente (sin quitar duplicados por nombre). */
  allChannels: Channel[];

  // Reproducción
  activeChannel: Channel | null;
  /** Canales navegables desde el reproductor (anterior/siguiente). */
  activeList: Channel[];

  // Usuario
  /** Ids (URL del stream) de los favoritos, en el orden en que se añadieron. */
  favorites: string[];
  /** Ids de los últimos canales vistos, el más reciente primero (máximo `RECENTS_LIMIT`). */
  recents: string[];
  searchQuery: string;
  hideUnavailable: boolean;
  /** Resolución fijada en el reproductor (alto en píxeles), o null para automática. */
  preferredHeight: number | null;
  hidden: HiddenGroups;

  init: () => Promise<LoadResult>;
  /** Carga las fuentes españolas en paralelo; resuelve en cuanto hay canales de alguna. */
  loadSpanishSources: () => Promise<LoadResult>;
  setSourceFilter: (filter: SourceFilter) => void;
  loadFromUrl: (url: string, options?: LoadOptions) => Promise<LoadResult>;
  loadFromFile: (file: File, options?: LoadOptions) => Promise<LoadResult>;
  retryLoad: () => Promise<LoadResult>;
  dismissNotice: () => void;
  playChannel: (channel: Channel, list?: Channel[]) => void;
  playNext: () => void;
  playPrev: () => void;
  /** Vuelve al último canal visto distinto del actual (tecla Retroceso). */
  playLast: () => void;
  closePlayer: () => void;
  setPlayerPrefs: (prefs: Partial<PlayerPrefs>) => void;
  toggleFavorite: (id: string) => void;
  /** Anota `id` como el último canal visto. */
  addRecent: (id: string) => void;
  setSearchQuery: (searchQuery: string) => void;
  toggleHideUnavailable: () => void;
  setPreferredHeight: (height: number | null) => void;
  toggleHidden: (kind: keyof HiddenGroups, name: string) => void;
  showAllGroups: () => void;
};

type SetState = StoreApi<IPTVState>['setState'];
type GetState = StoreApi<IPTVState>['getState'];

let currentLoad: AbortController | null = null; // carga en curso
let lastAttempt: (() => Promise<LoadResult>) | null = null; // repite el último intento de carga

async function runLoad(
  set: SetState,
  get: GetState,
  source: PlaylistSource,
  getText: (signal: AbortSignal) => Promise<string>,
  { notify = true }: LoadOptions = {},
): Promise<LoadResult> {
  currentLoad?.abort();
  const controller = new AbortController();
  currentLoad = controller;
  const { signal } = controller;
  lastAttempt = () => runLoad(set, get, source, getText, { notify });

  const hadChannels = get().channels.length > 0;
  set(hadChannels ? { isLoading: true } : { isLoading: true, status: 'loading', error: null });

  try {
    const text = await getText(signal);
    const channels = mergeChannels(parsePlaylist(text));
    if (signal.aborted) return { ok: false, aborted: true };

    set((state) => ({
      sources: {},
      sourceFilter: 'all',
      baseChannels: channels,
      allChannels: channels,
      ...visibleView(channels, channels, state.hidden),
      playlistSource: source,
      playlistVersion: state.playlistVersion + 1,
      status: 'ready',
      error: null,
      isLoading: false,
      searchQuery: '',
    }));
    return { ok: true };
  } catch (err) {
    if (signal.aborted) return { ok: false, aborted: true };
    const message = errorMessage(err);
    // Si ya había una lista cargada se conserva, y el error se notifica sin romper la vista.
    if (hadChannels) set({ isLoading: false, ...(notify ? { notice: message } : {}) });
    else set({ isLoading: false, status: 'error', error: message });
    return { ok: false, error: message };
  } finally {
    if (currentLoad === controller) currentLoad = null;
  }
}

const errorMessage = (err: unknown) =>
  (err instanceof Error && err.message) || 'Error desconocido al cargar la lista.';

type Sources = Partial<Record<SourceId, SourceState>>;

const readyChannels = (sources: Sources, ids: SourceId[]) =>
  ids.flatMap((id) => {
    const source = sources[id];
    return source?.status === 'ready' ? source.channels : [];
  });

/** `base` sin lo oculto, y sus categorías. */
function visibleView(base: Channel[], pool: Channel[], hidden: HiddenGroups) {
  const channels = applyHidden(base, pool, hidden);
  return { channels, categories: groupByCategory(channels) };
}

/** Lo que se ve con `filter`: las fuentes en su orden de prioridad, sin canales repetidos ni lo oculto. */
function sourceView(sources: Sources, filter: SourceFilter, hidden: HiddenGroups) {
  const order = SPANISH_SOURCES.map((s) => s.id);
  // Lo que llega sin categoría toma la de la misma cadena en cualquier fuente cargada.
  const pool = readyChannels(sources, order);
  const shown = readyChannels(sources, filter === 'all' ? order : [filter]);
  const baseChannels = mergeChannels(inheritCategories(shown, pool));
  const allChannels = [...new Map(inheritCategories(pool, pool).map((c) => [c.id, c])).values()];
  return { baseChannels, allChannels, ...visibleView(baseChannels, allChannels, hidden) };
}

async function loadSource(source: (typeof SPANISH_SOURCES)[number], signal: AbortSignal): Promise<SourceState> {
  try {
    const channels =
      source.kind === 'samsung' || source.kind === 'plex'
        ? await loadFastChannels(source, signal, (entries) => useGuide.getState().add(entries))
        : parsePlaylist(await fetchSourceText(source, signal), source);
    return { status: 'ready', channels };
  } catch (err) {
    return { status: 'error', error: errorMessage(err) };
  }
}

/**
 * Descarga las fuentes españolas a la vez y pinta cada una en cuanto llega: una fuente lenta
 * o caída no retrasa ni impide ver las demás. Resuelve con la primera que carga, o al final
 * si no ha cargado ninguna.
 */
function runSpanishLoad(set: SetState, get: GetState): Promise<LoadResult> {
  currentLoad?.abort();
  const controller = new AbortController();
  currentLoad = controller;
  const { signal } = controller;
  lastAttempt = () => runSpanishLoad(set, get);
  void loadGuide(); // en paralelo: no retrasa los canales y, si falla, solo se pierde la guía

  const sources: Sources = {};
  for (const source of SPANISH_SOURCES) sources[source.id] = { status: 'loading' };

  // Con canales ya en pantalla se dejan hasta que llegue la primera fuente nueva.
  const hadChannels = get().channels.length > 0;
  set(hadChannels ? { isLoading: true } : { isLoading: true, status: 'loading', error: null, sources: { ...sources } });

  return new Promise<LoadResult>((resolve) => {
    let pending = SPANISH_SOURCES.length;
    let anyReady = false;

    const finish = () => {
      if (currentLoad === controller) currentLoad = null;
      const failed = SPANISH_SOURCES.filter((s) => sources[s.id]?.status === 'error');

      if (!anyReady) {
        const details = failed
          .map((s) => {
            const state = sources[s.id];
            return `${s.label}: ${state?.status === 'error' ? state.error : ''}`;
          })
          .join(' · ');
        const message = `No se pudo cargar ninguna fuente de canales. ${details}`;
        if (hadChannels) set({ isLoading: false, notice: message });
        else set({ isLoading: false, status: 'error', error: message, sources: { ...sources } });
        resolve({ ok: false, error: message });
        return;
      }

      set({
        isLoading: false,
        ...(failed.length
          ? {
              notice: {
                message: `No se pudo cargar ${failed.map((s) => s.label).join(' ni ')}. Se muestran los canales del resto de fuentes.`,
                action: { label: 'Reintentar', run: () => void get().loadSpanishSources() },
              },
            }
          : {}),
      });
    };

    for (const source of SPANISH_SOURCES) {
      void loadSource(source, signal).then((result) => {
        if (signal.aborted) {
          resolve({ ok: false, aborted: true });
          return;
        }
        sources[source.id] = result;
        pending--;

        if (result.status === 'ready') {
          const firstReady = !anyReady;
          anyReady = true;
          set((state) => {
            const filter = firstReady ? 'all' : state.sourceFilter;
            return {
              playlistSource: { type: 'spanish' },
              sources: { ...sources },
              sourceFilter: filter,
              ...sourceView(sources, filter, state.hidden),
              status: 'ready',
              error: null,
              // Solo la primera fuente reinicia filas y búsqueda; las siguientes se suman sin saltos.
              ...(firstReady ? { playlistVersion: state.playlistVersion + 1, searchQuery: '' } : {}),
            };
          });
          if (firstReady) resolve({ ok: true });
        } else if (anyReady || !hadChannels) {
          set({ sources: { ...sources } });
        }

        if (pending === 0) finish();
      });
    }
  });
}

/** Canal anterior/siguiente, saltando los que ya se sabe que no están disponibles. */
function step(state: IPTVState, delta: 1 | -1): Partial<IPTVState> {
  const list = state.activeList;
  if (!list.length) return {};
  const index = list.findIndex((c) => c.id === state.activeChannel?.id);
  const at = (offset: number) => list[(index + offset * delta + list.length * list.length) % list.length]!;
  for (let offset = 1; offset < list.length; offset++) {
    if (!isKnownOffline(at(offset).id)) return { activeChannel: at(offset) };
  }
  return { activeChannel: at(1) }; // todos caídos: se avanza igualmente
}

export const useIPTVStore = create<IPTVState>()(
  persist(
    (set, get) => ({
      playlistSource: null,
      playlistVersion: 0,
      status: 'idle',
      isLoading: false,
      error: null,
      notice: null,

      sources: {},
      sourceFilter: 'all',
      baseChannels: [],
      channels: [],
      categories: [],
      allChannels: [],

      activeChannel: null,
      activeList: [],
      volume: 1,
      muted: false,

      favorites: [],
      recents: [],
      searchQuery: '',
      hideUnavailable: false,
      preferredHeight: null,
      hidden: { categories: [], regions: [] },

      // Al abrir la app siempre se cargan las fuentes españolas unificadas.
      init: () => get().loadSpanishSources(),

      loadSpanishSources: () => runSpanishLoad(set, get),

      setSourceFilter: (filter) =>
        set((state) => {
          if (filter === state.sourceFilter || state.playlistSource?.type !== 'spanish') return {};
          return {
            sourceFilter: filter,
            ...sourceView(state.sources, filter, state.hidden),
            playlistVersion: state.playlistVersion + 1,
            searchQuery: '',
          };
        }),

      loadFromUrl: (url, options) =>
        runLoad(set, get, { type: 'url', value: url }, (signal) => fetchPlaylistText(url, signal), options),

      loadFromFile: (file, options) =>
        runLoad(set, get, { type: 'file', value: file.name }, () => readPlaylistFile(file), options),

      retryLoad: () => (lastAttempt ? lastAttempt() : get().init()),

      dismissNotice: () => set({ notice: null }),

      playChannel: (channel, list) =>
        set({ activeChannel: channel, activeList: list?.length ? list : [channel] }),
      playNext: () => set((state) => step(state, 1)),
      playPrev: () => set((state) => step(state, -1)),
      playLast: () =>
        set((state) => {
          for (const id of state.recents) {
            const channel = state.channels.find((c) => c.id === id || c.sources.includes(id));
            if (!channel || channel.id === state.activeChannel?.id) continue;
            // Si no está en la lista que se navega (otra categoría), se navega por todos los canales.
            const inList = state.activeList.some((c) => c.id === channel.id);
            return { activeChannel: channel, activeList: inList ? state.activeList : state.channels };
          }
          return {};
        }),
      closePlayer: () => set({ activeChannel: null, activeList: [] }),

      setPlayerPrefs: (prefs) => set(prefs),

      addRecent: (id) =>
        set((state) =>
          state.recents[0] === id
            ? {}
            : { recents: [id, ...state.recents.filter((r) => r !== id)].slice(0, RECENTS_LIMIT) },
        ),

      toggleFavorite: (id) =>
        set((state) => ({
          favorites: state.favorites.includes(id)
            ? state.favorites.filter((f) => f !== id)
            : [...state.favorites, id],
        })),

      setSearchQuery: (searchQuery) => set({ searchQuery }),

      setPreferredHeight: (preferredHeight) => set({ preferredHeight }),

      toggleHideUnavailable: () => set((state) => ({ hideUnavailable: !state.hideUnavailable })),

      toggleHidden: (kind, name) =>
        set((state) => {
          const list = state.hidden[kind];
          const hidden = {
            ...state.hidden,
            [kind]: list.includes(name) ? list.filter((n) => n !== name) : [...list, name],
          };
          return { hidden, ...visibleView(state.baseChannels, state.allChannels, hidden) };
        }),

      showAllGroups: () =>
        set((state) => {
          const hidden = { categories: [], regions: [] };
          return { hidden, ...visibleView(state.baseChannels, state.allChannels, hidden) };
        }),
    }),
    {
      name: 'iptv-store',
      version: 1,
      partialize: (state) => ({
        favorites: state.favorites,
        recents: state.recents,
        volume: state.volume,
        muted: state.muted,
        hideUnavailable: state.hideUnavailable,
        preferredHeight: state.preferredHeight,
        hidden: state.hidden,
        // La lista cargada no se guarda: al abrir la app siempre se cargan las fuentes españolas.
      }),
    },
  ),
);
