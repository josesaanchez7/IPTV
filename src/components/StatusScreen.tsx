import { LoaderCircle, RotateCcw, TriangleAlert } from 'lucide-react';
import { DEFAULT_PLAYLIST_URL } from '../config';
import { useIPTVStore } from '../store/useIPTVStore';

export default function StatusScreen() {
  const status = useIPTVStore((s) => s.status);
  const error = useIPTVStore((s) => s.error);
  const retryLoad = useIPTVStore((s) => s.retryLoad);
  const loadFromUrl = useIPTVStore((s) => s.loadFromUrl);

  if (status !== 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-neutral-400" role="status">
        <LoaderCircle className="h-12 w-12 animate-spin text-brand" />
        <p>Cargando canales…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center" role="alert">
      <TriangleAlert className="h-14 w-14 text-brand" />
      <div>
        <h2 className="text-2xl font-bold">No se pudo cargar la lista</h2>
        <p className="mt-2 max-w-md text-neutral-400">{error}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={retryLoad}
          className="flex items-center gap-2 rounded-md bg-white px-5 py-2 font-semibold text-black hover:bg-white/80"
        >
          <RotateCcw className="h-4 w-4" />
          Reintentar
        </button>
        <button
          type="button"
          onClick={() => loadFromUrl(DEFAULT_PLAYLIST_URL)}
          className="rounded-md bg-neutral-700 px-5 py-2 font-semibold hover:bg-neutral-600"
        >
          Usar lista por defecto
        </button>
      </div>
    </div>
  );
}
