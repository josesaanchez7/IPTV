import parser from 'iptv-playlist-parser';
import {
  CATEGORY_ALIASES,
  CATEGORY_LABELS,
  CHANNEL_HINTS,
  FALLBACK_CATEGORY,
  GENERIC_GROUPS,
  NAME_CATEGORY_RULES,
  PLAYLIST_FETCH_TIMEOUT_MS,
  PRIORITY_CATEGORIES,
  REGION_ALIASES,
  REGIONAL_CATEGORY,
  SOURCE_FETCH_TIMEOUT_MS,
  type ChannelSource,
} from '../config';
import type { Category, Channel, ChannelBadges, HiddenGroups } from '../types';

/** La petición ni siquiera obtuvo respuesta: red caída o servidor que no permite CORS. */
class PlaylistNetworkError extends Error {}

export async function fetchPlaylistText(
  url: string,
  signal?: AbortSignal,
  timeoutMs = PLAYLIST_FETCH_TIMEOUT_MS,
): Promise<string> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(url, { signal: combined });
  } catch (err) {
    if (signal?.aborted) throw err;
    if (timeout.aborted) throw new Error('La lista tardó demasiado en descargarse.');
    throw new PlaylistNetworkError(
      'No se pudo descargar la lista. Comprueba la URL o si el servidor permite peticiones desde el navegador (CORS).',
    );
  }
  if (!response.ok) {
    throw new Error(`El servidor respondió ${response.status} al descargar la lista.`);
  }
  return response.text();
}

/**
 * Descarga la lista de una fuente. Si el servidor no deja descargarla desde el navegador,
 * se reintenta por el proxy de Vite. El tiempo máximo cubre los dos intentos.
 */
export async function fetchSourceText(source: ChannelSource, signal: AbortSignal): Promise<string> {
  const timeout = AbortSignal.timeout(SOURCE_FETCH_TIMEOUT_MS);
  const combined = AbortSignal.any([signal, timeout]);
  try {
    return await fetchPlaylistText(source.url, combined, SOURCE_FETCH_TIMEOUT_MS);
  } catch (err) {
    if (signal.aborted) throw err;
    if (timeout.aborted) throw new Error('No respondió a tiempo.');
    if (!source.proxy || !(err instanceof PlaylistNetworkError)) throw err;
  }

  // Sin proxy (build publicado como estático) llega el index.html o un 404: el motivo real es el CORS.
  const corsError = new Error('El servidor no permite descargar la lista desde el navegador (CORS).');
  const { pathname, search } = new URL(source.url);
  let text: string;
  try {
    text = await fetchPlaylistText(`${source.proxy}${pathname}${search}`, combined, SOURCE_FETCH_TIMEOUT_MS);
  } catch (err) {
    if (signal.aborted) throw err;
    if (timeout.aborted) throw new Error('No respondió a tiempo.');
    throw corsError;
  }
  if (!text.trimStart().startsWith('#EXTM3U')) throw corsError;
  return text;
}

export function readPlaylistFile(file: File): Promise<string> {
  return file.text();
}

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Nombre normalizado → categoría en español, para todas las grafías que se conocen. */
const CATEGORY_LOOKUP = new Map<string, string>([
  ...Object.entries(CATEGORY_LABELS),
  ...Object.values(CATEGORY_LABELS).map((label): [string, string] => [normalizeText(label), label]),
  ...Object.entries(CATEGORY_ALIASES).map(([alias, label]): [string, string] => [normalizeText(alias), label]),
]);

const REGION_LOOKUP = new Map(
  Object.entries(REGION_ALIASES).map(([alias, region]): [string, string] => [normalizeText(alias), region]),
);

const GENERIC_LOOKUP = new Set(GENERIC_GROUPS.map(normalizeText));

/**
 * Nombre normalizado para reconocer el mismo canal en listas distintas: sin acentos, sin lo que
 * va entre corchetes ("[Geo-blocked]"), sin marcas de calidad y sin el país. Lo que va entre
 * paréntesis se conserva, porque a veces distingue el canal: "La 1", "La 1 HD" y "La 1 (720p)"
 * dan la misma clave, pero "La 1 (Catalunya)" no (da la de "La 1 Catalunya").
 */
function nameKey(name: string): string {
  return normalizeText(name)
    .replace(/\[.*?\]/g, ' ')
    .replace(/\b(hd|fhd|uhd|sd|4k|\d{3,4}p|spain|espana)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '');
}

const HINT_LOOKUP = new Map(
  Object.entries(CHANNEL_HINTS).map(([name, hint]): [string, string] => [nameKey(name), hint]),
);

// Sin la bandera `g` para `.test()`, que con ella recuerda la posición entre llamadas.
const RESOLUTION_TAG = /\((\d{3,4})p\)/gi;
const PART_TIME_TAG = /\[not 24\/7\]/i;
const GEO_BLOCKED_TAG = /\[geo-?blocked\]/i;
/** Letras en círculo que Free-TV usa como notas: Ⓖ geobloqueado, Ⓢ sin HD, Ⓨ directo de YouTube. */
const CIRCLED_LETTERS = /[Ⓐ-ⓩ]/g;

function qualityOf(height: number): ChannelBadges['quality'] {
  if (height >= 2160) return '4K';
  if (height >= 1080) return 'FHD';
  if (height >= 720) return 'HD';
  return null;
}

/**
 * Separa del nombre las etiquetas que algunas listas meten en él y las convierte en distintivos:
 * resolución "(1080p)" (iptv-org), "[Not 24/7]" y "[Geo-blocked]" (iptv-org), Ⓖ y Ⓢ (Free-TV).
 */
function parseName(raw: string): { name: string; badges: ChannelBadges } {
  let height = 0;
  const name = raw
    .replace(RESOLUTION_TAG, (_, digits: string) => {
      height = Math.max(height, Number(digits));
      return ' ';
    })
    .replace(new RegExp(PART_TIME_TAG, 'gi'), ' ')
    .replace(new RegExp(GEO_BLOCKED_TAG, 'gi'), ' ')
    .replace(CIRCLED_LETTERS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    name,
    badges: {
      quality: raw.includes('Ⓢ') ? null : qualityOf(height),
      partTime: PART_TIME_TAG.test(raw),
      geoBlocked: raw.includes('Ⓖ') || GEO_BLOCKED_TAG.test(raw),
    },
  };
}

const QUALITY_RANK: Record<NonNullable<ChannelBadges['quality']>, number> = { HD: 1, FHD: 2, '4K': 3 };

/**
 * Distintivos de un canal unido: la mejor calidad de sus URLs; "emisión puntual" y "bloqueado
 * fuera de España" solo si lo son todas, porque basta una que no lo sea para verlo.
 */
function mergeBadges(members: Channel[]): ChannelBadges {
  const qualities = members.map((c) => c.badges.quality).filter((q) => q !== null);
  return {
    quality: qualities.reduce<ChannelBadges['quality']>((best, q) => (best && QUALITY_RANK[best] >= QUALITY_RANK[q] ? best : q), null),
    partTime: members.every((c) => c.badges.partTime),
    geoBlocked: members.every((c) => c.badges.geoBlocked),
  };
}

const isHttpUrl = (value: string | undefined): value is string => /^https?:\/\//i.test(value ?? '');

/** Quita las opciones estilo Kodi que algunas listas añaden tras `|` (user-agent, referer...). */
const cleanStreamUrl = (raw: string) => (raw.trim().split('|')[0] ?? '').trim();

/** Categorías del canal; una comunidad autónoma pasa a `REGIONAL_CATEGORY` y se guarda en `region`. */
function parseGroups(title: string | undefined): Pick<Channel, 'groups' | 'region'> {
  let region: string | null = null;
  const groups = (title ?? '')
    .split(';')
    .map((g) => g.trim())
    .filter((g) => g && g.toLowerCase() !== 'undefined' && !GENERIC_LOOKUP.has(normalizeText(g)))
    .map((g) => {
      const key = normalizeText(g);
      const regionName = REGION_LOOKUP.get(key);
      if (!regionName) return CATEGORY_LOOKUP.get(key) ?? g;
      region ??= regionName;
      return REGIONAL_CATEGORY;
    });
  return { groups: groups.length ? [...new Set(groups)] : [FALLBACK_CATEGORY], region };
}

const isUncategorized = (channel: Pick<Channel, 'groups'>) =>
  channel.groups.length === 1 && channel.groups[0] === FALLBACK_CATEGORY;

/**
 * Categoría para un canal que no trae una útil: la de `CHANNEL_HINTS` si es un canal conocido,
 * si no, la de la primera regla de `NAME_CATEGORY_RULES` que encaje con su nombre.
 */
function guessedGroups(name: string): Pick<Channel, 'groups' | 'region'> | null {
  const hint = HINT_LOOKUP.get(nameKey(name));
  if (hint) {
    const region = REGION_LOOKUP.get(normalizeText(hint));
    return region ? { groups: [REGIONAL_CATEGORY], region } : { groups: [hint], region: null };
  }
  const normalized = normalizeText(name);
  const rule = NAME_CATEGORY_RULES.find(([pattern]) => pattern.test(normalized));
  return rule ? { groups: [rule[1]], region: null } : null;
}

type ChannelEntry = {
  /** Clave estable del canal; por defecto, `url`. Distinta cuando se reproduce a través de un proxy. */
  id?: string;
  url: string;
  name: string;
  logo?: string;
  /** `group-title` tal cual lo da la fuente (varias separadas por `;`). */
  group?: string;
  tvgId?: string;
};

/** Canal normalizado: nombre limpio, logo válido y categorías en español. */
export function createChannel({ id, url, name: rawName, logo, group, tvgId }: ChannelEntry): Channel {
  const parsed = parseName(rawName);
  const name = parsed.name || 'Canal sin nombre';
  const groups = parseGroups(group);
  return {
    id: id ?? url,
    url,
    name,
    logo: isHttpUrl(logo) ? logo.trim() : null,
    ...(isUncategorized(groups) ? (guessedGroups(name) ?? groups) : groups),
    tvgId: tvgId?.trim() || null,
    sources: [url],
    badges: parsed.badges,
  };
}

/** Cómo cargar una lista concreta (ver `ChannelSource`). */
type ParseRules = Pick<ChannelSource, 'exclude' | 'excludeNames'>;

export function parsePlaylist(text: string, rules: ParseRules = {}): Channel[] {
  if (!text?.trimStart().startsWith('#EXTM3U')) {
    throw new Error('El contenido no es una lista M3U válida (falta la cabecera #EXTM3U).');
  }

  let parsed: ReturnType<typeof parser.parse>;
  try {
    parsed = parser.parse(text.trimStart());
  } catch {
    throw new Error('No se pudo interpretar la lista M3U.');
  }

  const seen = new Set<string>();
  const channels: Channel[] = [];
  for (const item of parsed.items) {
    if (!item?.url) continue;
    const url = cleanStreamUrl(item.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const categories = (item.group?.title ?? '').split(';').map((c) => normalizeText(c.trim()));
    if (rules.exclude?.some((excluded) => categories.includes(excluded))) continue;
    if (rules.excludeNames?.test(item.name || item.tvg?.name || '')) continue;

    channels.push(
      createChannel({
        url,
        name: item.name || item.tvg?.name || '',
        logo: item.tvg?.logo,
        group: item.group?.title,
        tvgId: item.tvg?.id,
      }),
    );
  }

  if (!channels.length) {
    throw new Error('La lista no contiene ningún canal reproducible.');
  }
  return channels;
}

/** Clave para reconocer el mismo canal en listas distintas (ver `nameKey`). */
function channelKey(channel: Channel): string {
  return nameKey(channel.name) || channel.id;
}

/**
 * Los canales que siguen sin categoría ("Otros") toman la de la misma cadena en otra fuente de
 * `pool`. Así una lista que no clasifica sus canales (Free-TV) los reparte como las demás.
 */
export function inheritCategories(channels: Channel[], pool: Channel[]): Channel[] {
  const known = new Map<string, Channel>();
  for (const channel of pool) {
    const key = channelKey(channel);
    if (!isUncategorized(channel) && !known.has(key)) known.set(key, channel);
  }
  return channels.map((channel) => {
    const match = isUncategorized(channel) ? known.get(channelKey(channel)) : undefined;
    return match ? { ...channel, groups: match.groups, region: match.region } : channel;
  });
}

/**
 * `tvg-id` comparable entre listas, que lo escriben cada una a su manera ("La1.TV", "La1.es@SD",
 * "La1.es"): sin la variante tras "@", sin el sufijo de país y sin signos.
 */
export function tvgKey(tvgId: string | null): string | null {
  if (!tvgId) return null;
  const base = (tvgId.toLowerCase().split('@')[0] ?? '').replace(/\.[a-z]{2,3}$/, '');
  return base.replace(/[^a-z0-9]+/g, '') || null;
}

/**
 * Une los canales repetidos, en una lista o entre listas: son el mismo si comparten `tvg-id`
 * (`tvgKey`) o nombre normalizado (`channelKey`), y la unión es transitiva (si A y B comparten
 * `tvg-id` y B y C el nombre, los tres son uno).
 *
 * El canal unido es el primero de su grupo (el orden de la entrada es la prioridad de las
 * fuentes, así que conserva su `id` y los favoritos siguen funcionando), con las URLs de todos en
 * `sources`, por ese orden, y el primer logo y la primera categoría útil que haya.
 */
export function mergeChannels(channels: Channel[]): Channel[] {
  // Unión de conjuntos sobre los índices: la raíz de cada grupo es su índice más bajo.
  const parent = new Map<number, number>();
  const root = (index: number): number => {
    let current = index;
    for (let next = parent.get(current); next !== undefined; next = parent.get(current)) current = next;
    return current;
  };
  const union = (a: number, b: number) => {
    const [ra, rb] = [root(a), root(b)];
    if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb));
  };

  const firstWithKey = new Map<string, number>();
  channels.forEach((channel, index) => {
    const tvg = tvgKey(channel.tvgId);
    for (const key of [`nombre:${channelKey(channel)}`, ...(tvg ? [`tvg:${tvg}`] : [])]) {
      const other = firstWithKey.get(key);
      if (other === undefined) firstWithKey.set(key, index);
      else union(index, other);
    }
  });

  // Agrupados en el orden de la entrada: cada grupo aparece donde estaba su primer canal.
  const groups = new Map<number, Channel[]>();
  channels.forEach((channel, index) => {
    const key = root(index);
    const members = groups.get(key);
    if (members) members.push(channel);
    else groups.set(key, [channel]);
  });

  return [...groups.values()].map((members) => {
    const [first, ...rest] = members;
    if (!first) throw new Error('Grupo de canales vacío.'); // no ocurre: cada grupo nace con un canal
    if (!rest.length) return first;
    const categorized = members.find((c) => !isUncategorized(c)) ?? first;
    return {
      ...first,
      logo: members.find((c) => c.logo)?.logo ?? null,
      groups: categorized.groups,
      region: categorized.region,
      tvgId: members.find((c) => c.tvgId)?.tvgId ?? null,
      sources: [...new Set(members.flatMap((c) => c.sources))],
      badges: mergeBadges(members),
    };
  });
}

/**
 * Quita lo que el usuario ha ocultado. Los canales de una comunidad oculta desaparecen del todo,
 * también sus copias en otras fuentes (reconocidas con `channelKey`), que no suelen indicar la
 * comunidad. Las categorías ocultas se quitan de cada canal, y el que se queda sin ninguna desaparece.
 * `pool` son todos los canales cargados, para encontrar esas copias.
 */
export function applyHidden(channels: Channel[], pool: Channel[], hidden: HiddenGroups): Channel[] {
  if (!hidden.categories.length && !hidden.regions.length) return channels;
  const regions = new Set(hidden.regions);
  const categories = new Set(hidden.categories);
  const hiddenKeys = new Set(pool.filter((c) => c.region && regions.has(c.region)).map(channelKey));

  const visible: Channel[] = [];
  for (const channel of channels) {
    if (hiddenKeys.has(channelKey(channel))) continue;
    if (!channel.groups.some((g) => categories.has(g))) {
      visible.push(channel);
      continue;
    }
    const groups = channel.groups.filter((g) => !categories.has(g));
    if (groups.length) visible.push({ ...channel, groups });
  }
  return visible;
}

const priorityOf = (name: string) => {
  const index = PRIORITY_CATEGORIES.indexOf(name);
  return index === -1 ? PRIORITY_CATEGORIES.length : index;
};

/**
 * Agrupa por categoría: primero las de `PRIORITY_CATEGORIES`, luego el resto de más a menos
 * canales, y la categoría de reserva al final.
 */
export function groupByCategory(channels: Channel[]): Category[] {
  const map = new Map<string, Channel[]>();
  for (const channel of channels) {
    for (const group of channel.groups) {
      const list = map.get(group);
      if (list) list.push(channel);
      else map.set(group, [channel]);
    }
  }
  return [...map.entries()]
    .map(([name, list]) => ({ name, channels: list }))
    .sort((a, b) => {
      if (a.name === FALLBACK_CATEGORY) return 1;
      if (b.name === FALLBACK_CATEGORY) return -1;
      return (
        priorityOf(a.name) - priorityOf(b.name) ||
        b.channels.length - a.channels.length ||
        a.name.localeCompare(b.name, 'es')
      );
    });
}

/**
 * Los canales que ahora emiten un programa cuyo título contiene `query` (sin acentos ni mayúsculas).
 * `programsOf` da los programas de un canal; los que no tienen guía no aparecen.
 */
export function filterByProgram(
  channels: Channel[],
  query: string,
  nowSeconds: number,
  programsOf: (channel: Channel) => { start: number; end: number; title: string }[] | undefined,
): Channel[] {
  const q = normalizeText(query.trim());
  if (!q) return [];
  return channels.filter((channel) => {
    const current = programsOf(channel)?.find((p) => p.start <= nowSeconds && nowSeconds < p.end);
    return current !== undefined && normalizeText(current.title).includes(q);
  });
}

export function filterChannels(channels: Channel[], query: string): Channel[] {
  const q = normalizeText(query.trim());
  if (!q) return channels;
  return channels.filter((c) => normalizeText(c.name).includes(q));
}
