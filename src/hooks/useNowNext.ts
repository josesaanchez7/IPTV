import { useMemo, useSyncExternalStore } from 'react';
import { nowAndNext, type NowNext, type Program } from '../lib/guide';
import { programsFor, useGuide } from '../store/useGuide';
import type { Channel } from '../types';

const TICK_MS = 30_000;

/** "Ahora" a precisión de minuto: el valor solo cambia (y repinta) una vez por minuto. */
const minute = () => Math.floor(Date.now() / 60_000) * 60;

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Un solo reloj para todas las tarjetas, y solo mientras haya alguna a la vista.
  timer ??= setInterval(() => listeners.forEach((l) => l()), TICK_MS);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** Segundos desde 1970 con precisión de minuto, actualizado solo. */
export const useNowSeconds = () => useSyncExternalStore(subscribe, minute);

/** Programas conocidos de `channel` (undefined si no hay guía para él). */
export function useChannelPrograms(channel: Channel): Program[] | undefined {
  return useGuide((state) => programsFor(state.programs, channel));
}

/** Qué emite `channel` ahora y qué viene después; se actualiza solo cada minuto. */
export function useNowNext(channel: Channel): NowNext {
  const programs = useChannelPrograms(channel);
  const now = useNowSeconds();
  return useMemo(() => nowAndNext(programs, now), [programs, now]);
}
