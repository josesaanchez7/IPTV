import { create } from 'zustand';
import { GUIDE_URL } from '../config';
import { fetchXmltvGuide, guideKeys, type Program } from '../lib/guide';
import type { Channel } from '../types';

type GuideState = {
  /** Programas por clave (ver `guideKeys`). Se reemplaza entero en cada carga, así que sus valores no cambian de identidad. */
  programs: ReadonlyMap<string, Program[]>;
  /** Suma programas; los de una clave que ya estaba sustituyen a los anteriores. */
  add: (entries: Iterable<[string, Program[]]>) => void;
};

/** La guía no se guarda: caduca en horas y se vuelve a descargar al abrir. */
export const useGuide = create<GuideState>()((set) => ({
  programs: new Map(),
  add: (entries) =>
    set((state) => {
      const next = new Map(state.programs);
      for (const [key, list] of entries) next.set(key, list);
      return { programs: next };
    }),
}));

/** Programas de `channel` en `programs`, o undefined si no se conocen. */
export function programsFor(programs: ReadonlyMap<string, Program[]>, channel: Channel): Program[] | undefined {
  for (const key of guideKeys(channel)) {
    const list = programs.get(key);
    if (list?.length) return list;
  }
  return undefined;
}

let loading: Promise<void> | null = null;

/**
 * Descarga la guía XMLTV de TDTChannels y la suma. Un fallo no molesta: sin guía, las tarjetas no
 * muestran programa. Si ya hay una descarga en curso, se espera a esa.
 */
export function loadGuide(): Promise<void> {
  loading ??= fetchXmltvGuide(GUIDE_URL)
    .then((programs) => useGuide.getState().add(programs))
    .catch(() => {})
    .finally(() => {
      loading = null;
    });
  return loading;
}
