/** Canal normalizado a partir de una entrada de la lista M3U. */
export type Channel = {
  /** URL del stream: única por canal y estable entre recargas (clave de favoritos y caché). */
  id: string;
  url: string;
  name: string;
  logo: string | null;
  /** Categorías ya traducidas; un canal puede estar en varias. */
  groups: string[];
  /** Comunidad autónoma, si la lista la usa como categoría (TDTChannels); el canal va a `REGIONAL_CATEGORY`. */
  region: string | null;
  /** `tvg-id` de la lista, si lo trae; sirve para reconocer el mismo canal en otras listas. */
  tvgId: string | null;
  /**
   * URLs que se pueden reproducir para este canal, por orden de preferencia; la primera es `url`.
   * Hay más de una cuando el canal estaba repetido (en la misma lista o en varias) y se ha unido:
   * si una falla, el reproductor pasa a la siguiente.
   */
  sources: string[];
  badges: ChannelBadges;
};

/**
 * Distintivos que las listas escribían dentro del nombre ("(1080p)", "[Not 24/7]",
 * "[Geo-blocked]", "Ⓖ"…): se quitan del nombre y se muestran aparte en la tarjeta.
 */
export type ChannelBadges = {
  /** HD desde 720p, FHD desde 1080p, 4K desde 2160p; null si es menos o no se sabe. */
  quality: 'HD' | 'FHD' | '4K' | null;
  /** No emite las 24 horas ("Emisión puntual"). */
  partTime: boolean;
  /** Solo se puede ver desde España ("Bloqueado fuera de España"). */
  geoBlocked: boolean;
};

/** Lo que el usuario ha decidido no ver. */
export type HiddenGroups = {
  categories: string[];
  regions: string[];
};

export type Category = {
  name: string;
  channels: Channel[];
};

/** Lo que hay cargado: las fuentes españolas unificadas, o una lista suelta (URL o archivo). */
export type PlaylistSource =
  | { type: 'spanish' }
  | {
      type: 'url' | 'file';
      /** URL de la lista o nombre del archivo local. */
      value: string;
    };

export type SourceId = 'tdt' | 'iptv-org' | 'free-tv' | 'samsung' | 'plex' | 'rakuten';

/** Estado de carga de una de las fuentes españolas; cada una va por su cuenta. */
export type SourceState =
  | { status: 'loading' }
  | { status: 'ready'; channels: Channel[] }
  | { status: 'error'; error: string };

/** "Todas" las fuentes juntas, o solo una. */
export type SourceFilter = SourceId | 'all';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export type LoadResult = { ok: true } | { ok: false; aborted: true } | { ok: false; aborted?: false; error: string };

export type LoadOptions = {
  /** Si la carga falla con una lista ya cargada, mostrar el error como aviso. */
  notify?: boolean;
};

export type NoticeAction = { label: string; run: () => void };

/** Aviso flotante: texto simple o mensaje con un botón de acción. */
export type Notice = string | { message: string; action?: NoticeAction };

export type StreamStatus = 'online' | 'offline';

/** Abre `channel` en el reproductor; `list` son los canales navegables con anterior/siguiente. */
export type PlayChannelHandler = (channel: Channel, list?: Channel[]) => void;
