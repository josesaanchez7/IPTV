import { Component, lazy, Suspense, type ReactNode } from 'react';
import { useIPTVStore } from '../store/useIPTVStore';
import type { Notice } from '../types';

// El reproductor arrastra hls.js: se descarga solo al abrir el primer canal.
const loadPlayer = () => lazy(() => import('./VideoPlayerModal'));
let VideoPlayerModal = loadPlayer();

// Mensajes de Chrome, Firefox y Safari cuando falla la descarga de un import() dinámico.
const isChunkLoadError = (error: unknown) =>
  error instanceof Error && /dynamically imported module|Importing a module script failed/i.test(error.message);

/**
 * El navegador recuerda una importación fallida hasta recargar la página, así que
 * un fallo de descarga solo se arregla recargando; un error interno sí permite reintentar.
 */
function noticeFor(error: unknown): Notice {
  if (isChunkLoadError(error)) {
    return {
      message: 'No se pudo descargar el reproductor. Comprueba la conexión y recarga la página.',
      action: { label: 'Recargar', run: () => window.location.reload() },
    };
  }
  return 'Se produjo un error en el reproductor. Inténtalo de nuevo.';
}

/**
 * Si el reproductor no se puede descargar o falla al pintarse, se cierra y se avisa
 * en vez de dejar la app en blanco.
 */
class PlayerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
    // React.lazy recuerda el fallo: se crea uno nuevo para que el siguiente intento empiece de cero.
    VideoPlayerModal = loadPlayer();
    useIPTVStore.setState({ notice: noticeFor(error) });
    useIPTVStore.getState().closePlayer();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function LazyPlayer() {
  return (
    <PlayerBoundary>
      <Suspense fallback={<div className="fixed inset-0 z-50 bg-black" />}>
        <VideoPlayerModal />
      </Suspense>
    </PlayerBoundary>
  );
}
