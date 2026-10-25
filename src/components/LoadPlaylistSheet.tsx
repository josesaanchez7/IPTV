import { Link, LoaderCircle, Upload } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { PRESET_PLAYLISTS } from '../config';
import { useIPTVStore } from '../store/useIPTVStore';
import type { LoadResult } from '../types';
import { SheetHeader } from './BottomSheet';

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Contenido del panel "Cargar lista M3U" (va dentro de `BottomSheet`). */
type LoadPlaylistSheetProps = {
  onClose: () => void;
};

export default function LoadPlaylistSheet({ onClose }: LoadPlaylistSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadFromUrl = useIPTVStore((s) => s.loadFromUrl);
  const loadFromFile = useIPTVStore((s) => s.loadFromFile);

  const [tab, setTab] = useState<'url' | 'file'>('url');
  const [url, setUrl] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const run = async (load: () => Promise<LoadResult>) => {
    setPending(true);
    setError(null);
    const result = await load();
    setPending(false);
    if (result.ok) onClose();
    else if (!result.aborted) setError(result.error);
  };

  const submitUrl = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = url.trim();
    if (!isValidHttpUrl(value)) {
      setError('Introduce una URL válida que empiece por http:// o https://');
      return;
    }
    run(() => loadFromUrl(value, { notify: false }));
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    run(() => loadFromFile(file, { notify: false }));
  };

  return (
    <>
      <SheetHeader title="Cargar lista M3U" onClose={onClose} />
      <div className="overflow-y-auto px-5 pb-6 md:px-6">

        <p className="mb-2 text-xs font-semibold tracking-wider text-neutral-400 uppercase">Listas de iptv-org</p>
        <div className="mb-6 flex flex-wrap gap-2">
          {PRESET_PLAYLISTS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={pending}
              onClick={() => run(() => loadFromUrl(preset.url, { notify: false }))}
              className="rounded-full bg-neutral-800 px-3.5 py-1.5 text-sm hover:bg-neutral-700 active:bg-neutral-700 disabled:opacity-50 md:px-3 md:py-1"
              title={preset.heavy ? 'Lista muy grande (miles de canales)' : preset.url}
            >
              {preset.label}
              {preset.heavy && <span className="ml-1 text-neutral-500">· pesada</span>}
            </button>
          ))}
        </div>

        <div className="mb-4 flex rounded-lg bg-neutral-800 p-1" role="tablist">
          {(
            [
            { id: 'url', label: 'Desde URL', Icon: Link },
            { id: 'file', label: 'Archivo local', Icon: Upload },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id);
                setError(null);
              }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-semibold transition ${
                tab === id ? 'bg-neutral-600 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'url' ? (
          <form onSubmit={submitUrl} className="flex flex-col gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              inputMode="url"
              placeholder="https://ejemplo.com/lista.m3u"
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2.5 placeholder:text-neutral-600 focus:border-neutral-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={pending}
              className="flex items-center justify-center gap-2 rounded-md bg-brand py-2.5 font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
            >
              {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Cargar
            </button>
          </form>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-10 text-center transition ${
              dragging ? 'border-brand bg-brand/10' : 'border-neutral-700'
            }`}
          >
            {pending ? (
              <LoaderCircle className="h-8 w-8 animate-spin text-neutral-400" />
            ) : (
              <Upload className="h-8 w-8 text-neutral-400" />
            )}
            <p className="text-sm text-neutral-400">Arrastra aquí un archivo .m3u / .m3u8 o</p>
            <button
              type="button"
              disabled={pending}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md bg-neutral-700 px-4 py-2 text-sm font-semibold hover:bg-neutral-600 disabled:opacity-60"
            >
              Elegir archivo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl,text/plain"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-brand/15 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
