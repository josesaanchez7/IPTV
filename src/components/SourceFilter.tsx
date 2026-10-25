import { ChevronDown, LoaderCircle } from 'lucide-react';
import { SPANISH_SOURCES } from '../config';
import { closeCategory } from '../hooks/useCategoryRoute';
import { useIPTVStore } from '../store/useIPTVStore';
import { useUIStore } from '../store/useUIStore';
import type { SourceFilter as SourceFilterValue, SourceState } from '../types';

type Option = { value: SourceFilterValue; label: string; state: SourceState | undefined };

function describe(state: SourceState | undefined): string | undefined {
  if (state?.status === 'loading') return 'Cargando…';
  if (state?.status === 'error') return `No se pudo cargar: ${state.error}`;
  if (state?.status === 'ready') return `${state.channels.length} canales`;
  return undefined;
}

/**
 * Selector "Todas / una sola fuente". Solo se muestra con las fuentes españolas cargadas;
 * una fuente que aún carga o que ha fallado aparece desactivada.
 * - `tabs`: pestañas de texto para la barra de escritorio.
 * - `chips`: fila deslizable de chips para el móvil, que termina con el chip "Categorías".
 */
type SourceFilterProps = {
  variant: 'tabs' | 'chips';
};

export default function SourceFilter({ variant }: SourceFilterProps) {
  const isSpanish = useIPTVStore((s) => s.playlistSource?.type === 'spanish');
  const sources = useIPTVStore((s) => s.sources);
  const sourceFilter = useIPTVStore((s) => s.sourceFilter);
  const setSourceFilter = useIPTVStore((s) => s.setSourceFilter);
  const hiddenCount = useIPTVStore((s) => s.hidden.categories.length + s.hidden.regions.length);
  const openSheet = useUIStore((s) => s.openSheet);

  const options: Option[] = isSpanish
    ? [
        { value: 'all', label: 'Todas', state: undefined },
        ...SPANISH_SOURCES.map((source) => ({ value: source.id, label: source.label, state: sources[source.id] })),
      ]
    : [];
  if (variant === 'tabs' && !isSpanish) return null;

  const isDisabled = (option: Option) => option.value !== 'all' && option.state?.status !== 'ready';

  const select = (value: SourceFilterValue) => {
    // La categoría abierta puede no existir en la otra fuente: se vuelve al inicio.
    closeCategory({ restoreScroll: false });
    setSourceFilter(value);
    window.scrollTo({ top: 0 });
  };

  if (variant === 'chips') {
    const chip = 'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition active:scale-95';
    return (
      <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4 pb-2.5 select-none" role="group" aria-label="Fuente de canales">
        {options.map((option) => {
          const active = sourceFilter === option.value;
          const disabled = isDisabled(option);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => select(option.value)}
              disabled={disabled}
              aria-pressed={active}
              title={describe(option.state)}
              className={`${chip} ${
                active ? 'border-white bg-white text-black' : 'border-white/40 text-white'
              } disabled:border-white/15 disabled:text-neutral-500 ${option.state?.status === 'error' ? 'line-through' : ''}`}
            >
              {option.label}
              {option.state?.status === 'loading' && <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-label="cargando" />}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => openSheet({ type: 'filter' })}
          className={`${chip} ${hiddenCount ? 'border-white/70' : 'border-white/40'} text-white`}
        >
          Categorías
          {hiddenCount > 0 && <span className="text-xs text-neutral-400 tabular-nums">−{hiddenCount}</span>}
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <ul className="flex items-center gap-5 text-sm" aria-label="Fuente de canales">
      {options.map((option) => {
        const active = sourceFilter === option.value;
        const disabled = isDisabled(option);
        return (
          <li key={option.value}>
            <button
              type="button"
              onClick={() => select(option.value)}
              disabled={disabled}
              aria-pressed={active}
              title={describe(option.state)}
              className={`flex items-center gap-1.5 transition hover:text-neutral-300 disabled:cursor-not-allowed disabled:text-neutral-600 ${
                active ? 'font-bold text-white' : 'text-neutral-300'
              } ${option.state?.status === 'error' ? 'line-through' : ''}`}
            >
              {option.label}
              {option.state?.status === 'loading' && (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-label="cargando" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
