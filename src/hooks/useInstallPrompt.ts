import { useCallback, useSyncExternalStore } from 'react';

/** `beforeinstallprompt` no está en los tipos del DOM (solo Chrome, Edge y Android). */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const isInstallPromptEvent = (event: Event): event is InstallPromptEvent => 'prompt' in event;

/** Abierta como app instalada (sin barra del navegador). */
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  Reflect.get(window.navigator, 'standalone') === true; // iPhone

/** Safari de iPhone/iPad: no hay botón de instalar posible, solo "Añadir a pantalla de inicio". */
const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad que se hace pasar por Mac

/*
 * El navegador lanza `beforeinstallprompt` una sola vez, al cargar, y los componentes que lo usan
 * (el menú "Más") se montan después. Por eso se guarda aquí, desde que se importa el módulo.
 */
type Snapshot = { canInstall: boolean; installed: boolean };
let deferred: InstallPromptEvent | null = null;
let installed = typeof window !== 'undefined' && isStandalone();
let snapshot: Snapshot = { canInstall: false, installed };
const listeners = new Set<() => void>();

function publish() {
  snapshot = { canInstall: !installed && deferred !== null, installed };
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // se lanza desde nuestro botón, no con la barra del navegador
    if (isInstallPromptEvent(event)) deferred = event;
    publish();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    publish();
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => snapshot;

export type InstallPrompt = {
  /** El navegador permite instalar con un clic (`install`). */
  canInstall: boolean;
  /** iPhone/iPad sin instalar: hay que hacerlo a mano desde el menú Compartir. */
  needsManualInstall: boolean;
  install: () => Promise<void>;
};

/**
 * Instalar la app como PWA con un botón propio. Si ya está instalada o abierta como app, no
 * ofrece nada.
 */
export function useInstallPrompt(): InstallPrompt {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  const install = useCallback(async () => {
    const event = deferred;
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // El aviso solo se puede lanzar una vez; si se rechaza, el navegador volverá a ofrecerlo más adelante.
    deferred = null;
    if (outcome === 'accepted') installed = true;
    publish();
  }, []);

  return { canInstall: state.canInstall, needsManualInstall: !state.installed && isIOS(), install };
}
