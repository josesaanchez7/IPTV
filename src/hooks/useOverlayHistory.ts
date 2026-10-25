import { useEffect } from 'react';
import { useIPTVStore } from '../store/useIPTVStore';
import { useUIStore } from '../store/useUIStore';

/**
 * Botón "atrás" (el del móvil o el del navegador) para lo que se abre encima de la vista:
 * reproductor, panel inferior y búsqueda del móvil. Mientras haya alguno abierto hay una
 * entrada propia en el historial; "atrás" cierra el de más arriba y, si quedan otros, la
 * entrada se vuelve a crear. Al cerrarlos desde la app se quita la entrada con
 * `history.back()`.
 *
 * La entrada usa la misma URL que la vista de debajo, así que la ruta de categoría no cambia.
 */

let entryActive = false; // hay una entrada propia encima en el historial
let selfBack = false; // el próximo popstate lo ha provocado la app al cerrar
let afterClose: (() => void)[] = [];

const isOpen = () => {
  const ui = useUIStore.getState();
  // Con el reproductor en ventana flotante (`pip`) la pantalla de debajo vuelve a ser la activa.
  return (useIPTVStore.getState().activeChannel !== null && !ui.pip) || ui.sheet !== null || ui.searchOpen;
};

function reconcile() {
  if (selfBack) return; // se espera a que termine el `back()` en curso
  const open = isOpen();
  if (open && !entryActive) {
    window.history.pushState({ iptvOverlay: true }, '', window.location.href);
    entryActive = true;
  } else if (!open && entryActive) {
    selfBack = true;
    window.history.back();
  }
}

/** Cierra lo de más arriba: reproductor, luego panel, luego búsqueda. */
function closeTop() {
  if (useIPTVStore.getState().activeChannel) useIPTVStore.getState().closePlayer();
  else if (useUIStore.getState().sheet) useUIStore.getState().closeSheet();
  else useUIStore.getState().closeSearch();
}

function onPopState() {
  if (!entryActive) return;
  entryActive = false;
  if (selfBack) {
    selfBack = false;
    afterClose.splice(0).forEach((run) => run());
  } else {
    closeTop();
  }
  reconcile();
}

/**
 * Ejecuta `run` cuando se haya quitado la entrada del historial de lo que se acaba de cerrar.
 * Hace falta para navegar justo después de cerrar algo: un `pushState` antes de que termine
 * el `back()` lo desharía.
 */
export function afterOverlaysClose(run: () => void) {
  if (selfBack) afterClose.push(run);
  else run();
}

export function useOverlayHistory() {
  useEffect(() => {
    window.addEventListener('popstate', onPopState);
    const unsubscribeIPTV = useIPTVStore.subscribe(reconcile);
    const unsubscribeUI = useUIStore.subscribe(reconcile);
    reconcile();
    return () => {
      window.removeEventListener('popstate', onPopState);
      unsubscribeIPTV();
      unsubscribeUI();
    };
  }, []);
}
