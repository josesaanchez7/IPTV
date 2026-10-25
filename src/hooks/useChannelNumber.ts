import { useCallback, useEffect, useRef, useState } from 'react';
import type { Channel } from '../types';

/** Pausa tras la última cifra antes de saltar, como en el mando de una tele. */
const COMMIT_DELAY_MS = 1500;
/** Cuánto se queda el número en pantalla tras saltar. */
const LINGER_MS = 900;

/** Lo que se muestra mientras se teclea: el número, a qué canal llevaría y si ya se ha saltado. */
export type ChannelNumberEntry = {
  text: string;
  target: Channel | null;
  done: boolean;
};

/**
 * Salto a un canal por su número (su posición en `list`, la misma que muestra el reproductor:
 * "3 / 35"). Se pueden teclear varias cifras: salta a los `COMMIT_DELAY_MS` de la última, al
 * llegar a tantas cifras como tiene el último número de la lista, o al pulsar `commit`.
 * Un número que no existe no hace nada.
 */
export function useChannelNumber(list: Channel[], onJump: (channel: Channel, list: Channel[]) => void) {
  const [entry, setEntry] = useState<ChannelNumberEntry | null>(null);
  const buffer = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Lo último que se sabe de la lista y del callback, para que los temporizadores no usen datos viejos.
  const latest = useRef({ list, onJump });
  latest.current = { list, onJump };

  useEffect(() => () => clearTimeout(timer.current), []);

  const finish = useCallback((jump: boolean) => {
    clearTimeout(timer.current);
    const { list: current, onJump: go } = latest.current;
    const target = current[Number(buffer.current) - 1] ?? null;
    if (jump && target) go(target, current);
    const text = buffer.current;
    buffer.current = '';
    setEntry({ text, target, done: true });
    timer.current = setTimeout(() => setEntry(null), LINGER_MS);
  }, []);

  const pressDigit = useCallback(
    (digit: string) => {
      clearTimeout(timer.current);
      const maxDigits = String(latest.current.list.length).length;
      buffer.current = buffer.current.length >= maxDigits ? digit : buffer.current + digit;
      const target = latest.current.list[Number(buffer.current) - 1] ?? null;
      setEntry({ text: buffer.current, target, done: false });
      if (buffer.current.length >= maxDigits) finish(true);
      else timer.current = setTimeout(() => finish(true), COMMIT_DELAY_MS);
    },
    [finish],
  );

  const commit = useCallback(() => {
    if (buffer.current) finish(true);
  }, [finish]);

  /** Descarta lo tecleado (p. ej. al cambiar de canal por otro medio). */
  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    buffer.current = '';
    setEntry(null);
  }, []);

  return { entry, pressDigit, commit, cancel, hasPending: () => buffer.current !== '' };
}
