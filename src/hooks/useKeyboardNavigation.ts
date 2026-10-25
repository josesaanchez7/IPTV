import { useEffect, useRef } from 'react';
import { useIPTVStore } from '../store/useIPTVStore';
import { useUIStore } from '../store/useUIStore';
import { closeCategory, useCategoryRoute } from './useCategoryRoute';

/** Los elementos por los que se mueven las flechas: tarjetas de canal y botones del banner. */
export const NAV_ATTRIBUTE = 'data-nav';
const NAV_SELECTOR = `[${NAV_ATTRIBUTE}]`;

/** Dos elementos están en la misma fila si sus centros distan menos de esta fracción de su alto. */
const SAME_ROW = 0.5;
/** Si no hay nada más en esa dirección, se desplaza la página esta fracción de la ventana. */
const SCROLL_STEP = 0.7;
const SCROLL_RETRY_MS = 350;

type Direction = 'up' | 'down' | 'left' | 'right';

const KEY_DIRECTION: Partial<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

const center = (rect: DOMRect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

/** Elementos navegables que están pintados (los de las filas aún sin cargar no existen en el DOM). */
function targets(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(NAV_SELECTOR)].filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

/**
 * El elemento más cercano a `from` en la dirección dada. En horizontal, solo de su misma fila y el
 * más próximo. En vertical, de la fila más cercana en esa dirección, el que quede más alineado.
 */
function neighbour(from: HTMLElement, direction: Direction, all: HTMLElement[]): HTMLElement | null {
  const fromRect = from.getBoundingClientRect();
  const origin = center(fromRect);
  const horizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'right' || direction === 'down' ? 1 : -1;

  const candidates = all
    .filter((el) => el !== from)
    .map((el) => {
      const rect = el.getBoundingClientRect();
      const { x, y } = center(rect);
      const sameRow = Math.abs(y - origin.y) < Math.min(fromRect.height, rect.height) * SAME_ROW;
      return { el, dx: (x - origin.x) * sign, dy: (y - origin.y) * sign, sameRow };
    });

  if (horizontal) {
    return candidates
      .filter((c) => c.sameRow && c.dx > 1)
      .sort((a, b) => a.dx - b.dx)[0]?.el ?? null;
  }
  const ahead = candidates.filter((c) => !c.sameRow && c.dy > 0);
  const nearestRow = Math.min(...ahead.map((c) => c.dy));
  return (
    ahead
      .filter((c) => c.dy - nearestRow < fromRect.height * SAME_ROW)
      .sort((a, b) => Math.abs(a.dx) - Math.abs(b.dx))[0]?.el ?? null
  );
}

function focusTarget(el: HTMLElement) {
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
}

/** Primer elemento navegable que se ve en la ventana (debajo de la barra superior). */
function firstVisible(all: HTMLElement[]): HTMLElement | undefined {
  const top = 72;
  return (
    all.find((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top >= top && rect.bottom <= window.innerHeight && rect.left >= 0;
    }) ?? all[0]
  );
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);

/**
 * Teclado y mando en la parrilla: las flechas mueven el foco por las tarjetas, Intro reproduce
 * (es el propio botón enfocado) y Esc sale de la categoría, de la búsqueda del móvil o limpia la
 * búsqueda. No actúa con el reproductor o un panel abiertos, ni al escribir en un campo.
 *
 * Con las flechas, la página no se desplaza sola: si no hay más tarjetas a la vista en esa
 * dirección, se desplaza un poco (para que carguen las filas de más abajo) y se vuelve a intentar.
 */
export function useKeyboardNavigation() {
  const categoryName = useCategoryRoute();
  const latest = useRef(categoryName);
  latest.current = categoryName;

  useEffect(() => {
    let retry: ReturnType<typeof setTimeout> | undefined;

    const move = (direction: Direction, retryOnce: boolean) => {
      const all = targets();
      const current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!current || !current.hasAttribute(NAV_ATTRIBUTE)) {
        const first = firstVisible(all);
        if (first) focusTarget(first);
        return;
      }
      const next = neighbour(current, direction, all);
      if (next) {
        focusTarget(next);
      } else if (retryOnce && (direction === 'up' || direction === 'down')) {
        window.scrollBy({ top: (direction === 'down' ? 1 : -1) * window.innerHeight * SCROLL_STEP, behavior: 'smooth' });
        clearTimeout(retry);
        retry = setTimeout(() => {
          if (document.activeElement === current) move(direction, false);
        }, SCROLL_RETRY_MS);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const ui = useUIStore.getState();
      if ((useIPTVStore.getState().activeChannel && !ui.pip) || ui.sheet) return;
      // Escribiendo en un campo, todo es del campo; salvo Esc en la búsqueda a pantalla completa del móvil.
      if (isTyping(e.target) && !(e.key === 'Escape' && useUIStore.getState().searchOpen)) return;

      const direction = KEY_DIRECTION[e.key];
      if (direction) {
        e.preventDefault();
        move(direction, true);
      } else if (e.key === 'Escape') {
        const ui = useUIStore.getState();
        if (ui.searchOpen) ui.closeSearch();
        else if (latest.current) closeCategory();
        else if (useIPTVStore.getState().searchQuery) useIPTVStore.getState().setSearchQuery('');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(retry);
    };
  }, []);
}
