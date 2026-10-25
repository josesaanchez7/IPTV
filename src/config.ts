import type { SourceId } from "./types";

const IPTV_ORG = "https://iptv-org.github.io/iptv";

export const DEFAULT_PLAYLIST_URL = `${IPTV_ORG}/countries/es.m3u`;

export type PresetPlaylist = {
  id: string;
  label: string;
  url: string;
  /** Lista muy grande (miles de canales). */
  heavy?: boolean;
};

export const PRESET_PLAYLISTS: PresetPlaylist[] = [
  { id: "es", label: "España", url: DEFAULT_PLAYLIST_URL },
  { id: "news", label: "Noticias", url: `${IPTV_ORG}/categories/news.m3u` },
  { id: "sports", label: "Deportes", url: `${IPTV_ORG}/categories/sports.m3u` },
  { id: "all", label: "Global", url: `${IPTV_ORG}/index.m3u`, heavy: true },
];

export type ChannelSource = {
  id: SourceId;
  label: string;
  url: string;
  /**
   * Formato de `url`: una lista M3U (por defecto) o los datos de canales que i.mjh.nz publica en
   * GitHub para Samsung TV Plus y Plex (JSON comprimido, ver `lib/fastChannels.ts`).
   */
  kind?: "m3u" | "samsung" | "plex";
  /**
   * Prefijo del proxy de Vite (`pnpm dev` / `pnpm preview`) para servidores que no permiten
   * descargar la lista desde el navegador (CORS). Solo se usa si la descarga directa falla.
   */
  proxy?: string;
  /**
   * Categorías de la lista (en minúsculas y sin acentos, como las escribe) cuyos canales se
   * descartan al cargarla.
   */
  exclude?: string[];
  /** Los canales cuyo nombre coincida se descartan (para lo que una lista trae pero no se debe ofrecer). */
  excludeNames?: RegExp;
};

/**
 * Datos de canales de i.mjh.nz en GitHub. Sus listas M3U (i.mjh.nz) las bloquean algunas
 * operadoras españolas por orden judicial, así que se construyen aquí a partir de estos datos.
 */
const MJH_DATA = "https://raw.githubusercontent.com/matthuisman/i.mjh.nz/master";

/**
 * Proxy de Vite para los streams de Samsung TV Plus: `jmp2.uk` los redirige al CDN real, pero
 * su redirección no permite CORS. Solo existe en `pnpm dev` y `pnpm preview`.
 */
export const JMP2_PROXY = "/proxy/jmp2";

/**
 * Fuentes que se cargan y unifican al abrir la app. El orden es la prioridad al quitar
 * duplicados: si un canal está en varias, se queda la versión de la primera.
 */
export const SPANISH_SOURCES: ChannelSource[] = [
  {
    id: "tdt",
    label: "TDTChannels",
    url: "https://www.tdtchannels.com/lists/tv.m3u8",
    proxy: "/proxy/tdt",
    // Canales extranjeros que TDTChannels incluye aparte; la app es solo de televisión de España.
    exclude: ["int. america", "int. europa", "int. asia", "int. africa", "int. otros"],
  },
  {
    id: "iptv-org",
    label: "iptv-org",
    url: DEFAULT_PLAYLIST_URL,
    // Esta lista trae reemisiones no autorizadas de canales de pago de Movistar Plus+ ("Liga de
    // Campeones por Movistar Plus+"…) y el Antena 3 que sale de una IP suelta (sin servidor oficial,
    // del tipo que caduca en semanas): la app solo ofrece emisiones gratuitas y oficiales.
    excludeNames: /\b(por movistar plus|antena 3 internacional)\b/i,
  },
  {
    id: "free-tv",
    label: "Free-TV",
    url: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_spain.m3u8",
  },
  {
    id: "samsung",
    label: "Samsung TV Plus",
    url: `${MJH_DATA}/SamsungTVPlus/.channels.json.gz`,
    kind: "samsung",
  },
  { id: "plex", label: "Plex", url: `${MJH_DATA}/Plex/.channels.json.gz`, kind: "plex" },
  // Canales gratuitos con anuncios de Rakuten TV en España (cine, series, deportes…). No hay una
  // fuente oficial ni del autor de i.mjh.nz: es una copia que mantiene una sola persona y los enlaces
  // pueden rotar, así que si deja de actualizarse esta fuente simplemente fallará (la app sigue).
  {
    id: "rakuten",
    label: "Rakuten TV",
    url: "https://raw.githubusercontent.com/coderfast/IPTV/HEAD/rakutentv.m3u",
    // La lista trae también canales en inglés o de Latinoamérica; la app es de televisión de España.
    excludeNames:
      /\b(doctor who|bbc|bloomberg|guardian|africanews|france 24|cgtn|newsworld|revry|reuters|filmrise|afv|fail army|people are awesome|pet collective|hard knocks|glory kickboxing|pfl mma|world billiards|vevo latino|todo novelas|kanal d|viki)\b/i,
  },
];

/** Tiempo máximo por fuente: si una tarda más, se da por fallida y se sigue con las demás. */
export const SOURCE_FETCH_TIMEOUT_MS = 20000;

/** Guía de programación XMLTV de TDTChannels (comprimida con gzip; permite CORS). */
export const GUIDE_URL = "https://www.tdtchannels.com/epg/TV.xml.gz";
export const GUIDE_FETCH_TIMEOUT_MS = 30000;
/** De la guía solo se guardan los programas que empiezan dentro de este tiempo (36 h). */
export const GUIDE_HORIZON_S = 36 * 60 * 60;

/** Tarjetas que se añaden por tramo en cada fila (render perezoso). */
export const ROW_PAGE_SIZE = 30;

/** Tiempo máximo para descargar una lista M3U. */
export const PLAYLIST_FETCH_TIMEOUT_MS = 30000;

/** Traducción de las categorías estándar de iptv-org. Las demás se muestran tal cual. */
export const CATEGORY_LABELS: Record<string, string> = {
  animation: "Animación",
  auto: "Motor",
  business: "Economía",
  classic: "Clásicos",
  comedy: "Comedia",
  cooking: "Cocina",
  culture: "Cultura",
  documentary: "Documentales",
  education: "Educación",
  entertainment: "Entretenimiento",
  family: "Familia",
  general: "Generalistas",
  interactive: "Interactivos",
  kids: "Infantil",
  legislative: "Institucional",
  lifestyle: "Estilo de vida",
  movies: "Cine",
  music: "Música",
  news: "Noticias",
  outdoor: "Aire libre",
  public: "Públicas",
  relax: "Relax",
  religious: "Religión",
  science: "Ciencia",
  series: "Series",
  shop: "Teletienda",
  sports: "Deportes",
  travel: "Viajes",
  weather: "El tiempo",
};

/**
 * Nombres con los que TDTChannels y otras listas llaman a categorías que ya existen arriba, para
 * que los canales de todas las fuentes caigan en la misma fila. Se comparan sin mayúsculas ni
 * acentos; los nombres traducidos de arriba ya se reconocen solos.
 */
export const CATEGORY_ALIASES: Record<string, string> = {
  informativos: "Noticias",
  "noticias internacionales": "Noticias",
  deportivos: "Deportes",
  "deportivos int.": "Deportes",
  deporte: "Deportes",
  infantiles: "Infantil",
  ninos: "Infantil",
  "ninos y familia": "Infantil",
  musicales: "Música",
  religiosos: "Religión",
  peliculas: "Cine",
  "cine y series": "Cine",
  documental: "Documentales",
  "estilo de vida y cocina": "Estilo de vida",
  comedias: "Comedia",
  "crimen y misterio": "Crimen",
  // Samsung TV Plus
  serie: "Series",
  telenovela: "Series",
  "musica & ambiente": "Música",
  "viajes y cocina": "Estilo de vida",
};

/**
 * Última opción para un canal sin categoría (Plex no las da): palabras de su nombre, ya sin
 * acentos y en minúsculas. Gana la primera regla que coincide.
 */
export const NAME_CATEGORY_RULES: [RegExp, string][] = [
  [/\b(series?|novelas?|telenovelas?|sitcom|drama)\b/, "Series"],
  [/\b(cine|peliculas?|movies?|film|accion|thriller|terror|western|runtime|pelimex)\b/, "Cine"],
  [/\b(comedia|comedy)\b/, "Comedia"],
  [/\b(news|noticias|cnn|bloomberg|headlines|milenio|actualidad)\b/, "Noticias"],
  [/\b(sports?|deportes?|fifa|nfl|nba|ufc|mma|tennis|golf|poker|billiard|lucha|futbol)\b/, "Deportes"],
  [/\b(kids?|ninos|infantil|junior|toons?|masha|pitufo|beyblade)\b/, "Infantil"],
  [/\b(crimen|crimenes|forenses?|cops|jail|misterios?)\b/, "Crimen"],
  [/\b(cocina|sabores|viajes?|travel|naturaleza|nature|casa|mueble)\b/, "Estilo de vida"],
];

/**
 * Categorías que solo dicen el país (Free-TV pone "Spain" a todos sus canales): no informan de
 * nada, así que se ignoran y la categoría sale de `CHANNEL_HINTS` o de la misma cadena en otra
 * fuente. Se comparan sin mayúsculas ni acentos.
 */
export const GENERIC_GROUPS = ["spain", "espana", "es"];

/**
 * Categoría (o comunidad autónoma, de `REGION_ALIASES`) de canales conocidos, para los que llegan
 * sin una categoría útil y no están en otra fuente. La clave es el nombre del canal; se compara
 * como al quitar duplicados (sin acentos, mayúsculas, "HD" ni lo que va entre paréntesis).
 */
export const CHANNEL_HINTS: Record<string, string> = {
  Cuatro: "Generalistas",
  Telecinco: "Generalistas",
  "La Sexta": "Generalistas",
  "TVE Internacional Europe-Asia": "Generalistas",
  Atreseries: "Series",
  Neox: "Series",
  Nova: "Series",
  FDF: "Series",
  Divinity: "Entretenimiento",
  Energy: "Entretenimiento",
  "Be Mad": "Entretenimiento",
  Mega: "Entretenimiento",
  "Paramount Network": "Cine",
  "BOM Cine": "Cine",
  Squirrel: "Cine",
  Negocios: "Economía",
  Boing: "Infantil",
  Telemadrid: "Madrid",
  "La Otra": "Madrid",
  "La 7 CYLTV": "Castilla y León",
  "Televisión Canaria": "Canarias",
  "IB3 Global": "Islas Baleares",
  "Aragón TV": "Aragón",
  "TV3Cat": "Cataluña",
  "3/24": "Cataluña",
  "Bon Dia": "Cataluña",
  SX3: "Cataluña",
  "El 33": "Cataluña",
  "À Punt TV": "Comunidad Valenciana",
  "7 Región de Murcia": "Murcia",
};

/** Categoría única para los canales de todas las comunidades autónomas. */
export const REGIONAL_CATEGORY = "Autonómicas";

/**
 * Categorías que en realidad son comunidades autónomas (TDTChannels agrupa así sus canales
 * regionales) → nombre que se muestra. Se comparan sin mayúsculas ni acentos.
 */
export const REGION_ALIASES: Record<string, string> = {
  andalucia: "Andalucía",
  aragon: "Aragón",
  asturias: "Asturias",
  "p. de asturias": "Asturias",
  "principado de asturias": "Asturias",
  "illes balears": "Islas Baleares",
  "islas baleares": "Islas Baleares",
  baleares: "Islas Baleares",
  canarias: "Canarias",
  cantabria: "Cantabria",
  "castilla y leon": "Castilla y León",
  "castilla-la mancha": "Castilla-La Mancha",
  "castilla la mancha": "Castilla-La Mancha",
  cataluna: "Cataluña",
  catalunya: "Cataluña",
  "c. valenciana": "Comunidad Valenciana",
  "comunidad valenciana": "Comunidad Valenciana",
  extremadura: "Extremadura",
  galicia: "Galicia",
  "la rioja": "La Rioja",
  "c. de madrid": "Madrid",
  "comunidad de madrid": "Madrid",
  madrid: "Madrid",
  "r. de murcia": "Murcia",
  "region de murcia": "Murcia",
  murcia: "Murcia",
  "c. foral de navarra": "Navarra",
  navarra: "Navarra",
  "pais vasco": "País Vasco",
  euskadi: "País Vasco",
  ceuta: "Ceuta",
  melilla: "Melilla",
};

/** Categorías que encabezan el inicio en este orden; el resto va detrás, de más a menos canales. */
export const PRIORITY_CATEGORIES = [
  "Generalistas",
  "Noticias",
  REGIONAL_CATEGORY,
  "Deportes",
  "Cine",
  "Series",
  "Entretenimiento",
  "Infantil",
  "Documentales",
  "Música",
];

export const FALLBACK_CATEGORY = "Otros";
export const FAVORITES_CATEGORY = "Mis favoritos";
export const RECENTS_CATEGORY = "Seguir viendo";
export const FOOTBALL_CATEGORY = "Fútbol hoy";

/** Cuántos canales recuerda "Seguir viendo". */
export const RECENTS_LIMIT = 15;

