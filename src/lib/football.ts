import type { Program } from './guide';

/**
 * Qué programas de la guía son un partido de fútbol. No basta con que el título hable de fútbol
 * (hay telediarios, tertulias, resúmenes y programas de clubes llamados "LaLiga" o "Liga F"):
 * tiene que nombrar una competición o el fútbol Y un enfrentamiento ("Real Madrid - Villarreal"),
 * y no ser un resumen ni una repetición.
 */
const COMPETITION =
  /f[uú]tbol|laliga|la liga|liga ea sports|liga bbva|champions league|copa del rey|supercopa|europa league|conference league|hypermotion|primera rfef|segunda rfef|tercera rfef|liga f\b|selecci[oó]n espa[nñ]ola|eurocopa|mundial de clubes|uefa/i;
const VERSUS = / (?:-|–|vs\.?|v) /i;
const NOT_A_MATCH =
  /res[uú]men|resumenes|historia|mejores|lo mejor|repetici[oó]n|repaso|cr[oó]nica|previa|post ?partido|an[aá]lisis|magazine|tertulia|el d[ií]a despu[eé]s|millors|americ[aà]n?o?/i; // "fútbol americano" no es lo que se busca

export function isFootballMatch(program: Pick<Program, 'title'>): boolean {
  const { title } = program;
  return COMPETITION.test(title) && VERSUS.test(title) && !NOT_A_MATCH.test(title);
}

/** "Hoy" para la fila: hasta las 6:00 de la madrugada siguiente, para no cortar los partidos de la noche. */
function endOfFootballDay(nowSeconds: number): number {
  const limit = new Date(nowSeconds * 1000);
  if (limit.getHours() >= 6) limit.setDate(limit.getDate() + 1);
  limit.setHours(6, 0, 0, 0);
  return limit.getTime() / 1000;
}

/**
 * El primer partido que cada canal emite ahora o más tarde hoy, por clave de canal. `programsOf`
 * da los programas de un canal (ver `programsFor`). Los que ya han terminado no cuentan.
 */
export function footballToday<T extends { id: string }>(
  channels: T[],
  nowSeconds: number,
  programsOf: (channel: T) => Program[] | undefined,
): Map<string, Program> {
  const limit = endOfFootballDay(nowSeconds);
  const matches = new Map<string, Program>();
  for (const channel of channels) {
    const match = programsOf(channel)?.find((p) => p.end > nowSeconds && p.start < limit && isFootballMatch(p));
    if (match) matches.set(channel.id, match);
  }
  return matches;
}
