import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';

const LONG_PRESS_MS = 450;
/** Si el dedo se mueve más que esto, es un scroll y no una pulsación larga. */
const MOVE_TOLERANCE_PX = 10;

/**
 * Anula el clic que algunos navegadores lanzan al levantar el dedo tras una pulsación larga.
 * Se escucha en toda la ventana porque, si la pulsación abre un panel, ese clic cae en su fondo
 * (y lo cerraría), no en el elemento pulsado.
 */
function swallowNextClick() {
  const swallow = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  // Si el navegador no lanza ese clic, el siguiente toque del usuario no debe perderse.
  window.addEventListener('pointerdown', () => setTimeout(() => window.removeEventListener('click', swallow, { capture: true })), {
    capture: true,
    once: true,
  });
}

/**
 * Pulsación larga con el dedo (solo táctil). Devuelve manejadores para el elemento; el clic
 * que el navegador lanza al soltar tras una pulsación larga se anula, y también el menú
 * contextual del sistema.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  const cancel = () => {
    clearTimeout(timer.current);
    start.current = null;
  };

  return {
    onPointerDown: (e: PointerEvent) => {
      fired.current = false;
      if (e.pointerType !== 'touch') return;
      start.current = { x: e.clientX, y: e.clientY };
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        fired.current = true;
        start.current = null;
        swallowNextClick();
        navigator.vibrate?.(10);
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      const origin = start.current;
      if (origin && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > MOVE_TOLERANCE_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: MouseEvent) => {
      if (fired.current || start.current) e.preventDefault();
    },
  };
}
