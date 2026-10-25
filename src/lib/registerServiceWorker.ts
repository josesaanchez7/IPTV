import { useIPTVStore } from '../store/useIPTVStore';

/**
 * Registra `public/sw.js` (solo en producción: en `pnpm dev` el service worker haría que Vite sirviera
 * archivos viejos). Cuando hay una versión nueva ya descargada avisa con un botón "Actualizar", en
 * lugar de recargar sola, para no cortar lo que se esté viendo.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  // La primera vez que se instala, el service worker toma el control sin que haya nada que actualizar.
  const hadController = navigator.serviceWorker.controller !== null;
  let updateRequested = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && updateRequested) window.location.reload();
  });

  const offerUpdate = (worker: ServiceWorker) => {
    useIPTVStore.setState({
      notice: {
        message: 'Hay una versión nueva de IPTVFlix.',
        action: {
          label: 'Actualizar',
          run: () => {
            updateRequested = true;
            worker.postMessage({ type: 'SKIP_WAITING' });
          },
        },
      },
    });
  };

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (registration.waiting && hadController) offerUpdate(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
          });
        });
        // Una pestaña abierta muchos días también busca versiones nuevas.
        setInterval(() => void registration.update().catch(() => {}), 60 * 60 * 1000);
      })
      .catch(() => {
        // Sin service worker la app funciona igual; solo se pierde abrir sin conexión.
      });
  });
}
