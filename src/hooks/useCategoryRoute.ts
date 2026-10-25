import { useSyncExternalStore } from 'react';

/**
 * Ruta mínima basada en el hash (`#/categoria/<nombre>`) para la vista de categoría:
 * funciona el botón "atrás" del navegador y la URL se puede guardar o compartir.
 */
const PREFIX = '#/categoria/';
const ROUTE_EVENT = 'iptv:route';

let restoreScrollOnClose = true;

function readCategory(): string | null {
  if (!window.location.hash.startsWith(PREFIX)) return null;
  try {
    return decodeURIComponent(window.location.hash.slice(PREFIX.length)) || null;
  } catch {
    return null;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback);
  window.addEventListener('hashchange', callback);
  window.addEventListener(ROUTE_EVENT, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener('hashchange', callback);
    window.removeEventListener(ROUTE_EVENT, callback);
  };
}

export function useCategoryRoute(): string | null {
  return useSyncExternalStore(subscribe, readCategory);
}

export function openCategory(name: string) {
  if (readCategory() === name) return;
  window.history.pushState({ iptvCategory: true }, '', `${PREFIX}${encodeURIComponent(name)}`);
  window.dispatchEvent(new Event(ROUTE_EVENT));
}

/**
 * Vuelve al inicio. Si la categoría se abrió desde la app, equivale a "atrás".
 * Con `restoreScroll: false` el inicio se muestra desde arriba en vez de donde se dejó.
 */
export function closeCategory({ restoreScroll = true }: { restoreScroll?: boolean } = {}) {
  if (!readCategory()) return;
  restoreScrollOnClose = restoreScroll;
  if (window.history.state?.iptvCategory) {
    window.history.back();
  } else {
    // Se entró directamente con la URL de la categoría: no hay "atrás" dentro de la app.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    window.dispatchEvent(new Event(ROUTE_EVENT));
  }
}

/** Indica (una sola vez) si al volver al inicio hay que recuperar su posición de scroll. */
export function consumeRestoreScroll(): boolean {
  const value = restoreScrollOnClose;
  restoreScrollOnClose = true;
  return value;
}
