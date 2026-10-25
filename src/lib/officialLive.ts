import type { Channel } from '../types';

/**
 * Canales que no ofrecen una emisión abierta que se pueda reproducir aquí (Mediaset y Atresmedia
 * solo emiten en directo dentro de su web o app, con su propio reproductor), pero sí tienen una
 * página oficial de directo. Las listas públicas traen para ellos enlaces caducados (los de
 * Akamai responden 400) o cerrados (403), y las alternativas son reemisiones no autorizadas, que
 * la app no ofrece. En su lugar, el reproductor y el panel de acciones enlazan a la web oficial.
 *
 * Las direcciones se comprobaron una a una (cargan su reproductor en directo desde España). Si
 * alguna deja de existir, el enlace llevaría a una página de error: se arregla aquí.
 */
export type OfficialLive = {
  /** Nombre del canal tal como lo muestra la app (sin etiquetas de calidad). */
  name: string;
  /** Quién lo emite y dónde: "Mediaset Infinity". */
  service: string;
  url: string;
};

const MEDIASET = 'https://www.mediasetinfinity.es/directo';
const ATRESPLAYER = 'https://www.atresplayer.com/directos';

const OFFICIAL_LIVE: OfficialLive[] = [
  { name: 'Telecinco', service: 'Mediaset Infinity', url: `${MEDIASET}/telecinco/` },
  { name: 'Cuatro', service: 'Mediaset Infinity', url: `${MEDIASET}/cuatro/` },
  { name: 'FDF', service: 'Mediaset Infinity', url: `${MEDIASET}/fdf/` },
  { name: 'Divinity', service: 'Mediaset Infinity', url: `${MEDIASET}/divinity/` },
  { name: 'Energy', service: 'Mediaset Infinity', url: `${MEDIASET}/energy/` },
  { name: 'Be Mad', service: 'Mediaset Infinity', url: `${MEDIASET}/bemad/` },
  { name: 'Boing', service: 'Mediaset Infinity', url: `${MEDIASET}/boing/` },
  { name: 'Antena 3', service: 'Atresplayer', url: `${ATRESPLAYER}/antena3/` },
  { name: 'La Sexta', service: 'Atresplayer', url: `${ATRESPLAYER}/lasexta/` },
  { name: 'Neox', service: 'Atresplayer', url: `${ATRESPLAYER}/neox/` },
  { name: 'Nova', service: 'Atresplayer', url: `${ATRESPLAYER}/nova/` },
  { name: 'Mega', service: 'Atresplayer', url: `${ATRESPLAYER}/mega/` },
  { name: 'Atreseries', service: 'Atresplayer', url: `${ATRESPLAYER}/atreseries/` },
];

const BY_NAME = new Map(OFFICIAL_LIVE.map((entry) => [entry.name.toLowerCase(), entry]));

/** La página oficial de directo de `channel`, si la tiene (el nombre tiene que coincidir entero). */
export function officialLive(channel: Pick<Channel, 'name'>): OfficialLive | null {
  return BY_NAME.get(channel.name.trim().toLowerCase()) ?? null;
}
