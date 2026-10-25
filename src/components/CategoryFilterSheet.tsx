import { useMemo } from 'react';
import { groupByCategory } from '../lib/playlist';
import { useIPTVStore } from '../store/useIPTVStore';
import { SheetHeader } from './BottomSheet';

type Option = { name: string; count: number };

/** Opciones con su número de canales; las ocultas que no aparecen en la lista actual siguen ahí, con 0, para poder volver a mostrarlas. */
function withHidden(options: Option[], hidden: string[]): Option[] {
  const present = new Set(options.map((o) => o.name));
  return [...options, ...hidden.filter((name) => !present.has(name)).map((name) => ({ name, count: 0 }))];
}

/**
 * Contenido del panel "Categorías" (va dentro de `BottomSheet`): casillas para ocultar
 * categorías y comunidades autónomas. Se aplica al momento y se recuerda en el navegador.
 * Las opciones salen de los canales de la fuente elegida, antes de ocultar nada.
 */
type CategoryFilterSheetProps = {
  onClose: () => void;
};

export default function CategoryFilterSheet({ onClose }: CategoryFilterSheetProps) {
  const baseChannels = useIPTVStore((s) => s.baseChannels);
  const hidden = useIPTVStore((s) => s.hidden);
  const toggleHidden = useIPTVStore((s) => s.toggleHidden);
  const showAllGroups = useIPTVStore((s) => s.showAllGroups);

  const { categories, regions } = useMemo(() => {
    const regionCounts = new Map<string, number>();
    for (const channel of baseChannels) {
      if (channel.region) regionCounts.set(channel.region, (regionCounts.get(channel.region) ?? 0) + 1);
    }
    return {
      categories: groupByCategory(baseChannels).map((c) => ({ name: c.name, count: c.channels.length })),
      regions: [...regionCounts]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    };
  }, [baseChannels]);

  const hiddenCount = hidden.categories.length + hidden.regions.length;

  return (
    <>
      <SheetHeader
        title="Categorías"
        description="Desmarca lo que no quieras ver. Se aplica al momento y se recuerda en este navegador."
        onClose={onClose}
      />

      <div className="space-y-6 overflow-y-auto border-y border-white/10 px-5 py-5 md:px-6">
        <Section
          title="Categorías"
          options={withHidden(categories, hidden.categories)}
          hidden={hidden.categories}
          onToggle={(name) => toggleHidden('categories', name)}
        />
        {(regions.length > 0 || hidden.regions.length > 0) && (
          <Section
            title="Comunidades autónomas"
            description="Ocultar una comunidad quita sus canales de todas partes, también si otra fuente los trae."
            options={withHidden(regions, hidden.regions)}
            hidden={hidden.regions}
            onToggle={(name) => toggleHidden('regions', name)}
          />
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 px-5 py-4 md:px-6">
        <button
          type="button"
          onClick={showAllGroups}
          disabled={hiddenCount === 0}
          className="py-2 text-sm font-semibold text-neutral-300 hover:text-white disabled:cursor-not-allowed disabled:text-neutral-600"
        >
          Mostrar todo
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover active:bg-brand-hover"
        >
          Listo
        </button>
      </div>
    </>
  );
}

type SectionProps = {
  title: string;
  description?: string;
  options: Option[];
  hidden: string[];
  onToggle: (name: string) => void;
};

function Section({ title, description, options, hidden, onToggle }: SectionProps) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold tracking-wider text-neutral-400 uppercase">{title}</legend>
      {description && <p className="mt-1 text-xs text-neutral-500">{description}</p>}
      <div className="mt-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.name}
            className="-mx-2 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 text-base select-none hover:bg-white/5 active:bg-white/10 md:py-1.5 md:text-sm"
          >
            <input
              type="checkbox"
              checked={!hidden.includes(option.name)}
              onChange={() => onToggle(option.name)}
              className="h-5 w-5 shrink-0 accent-brand md:h-4 md:w-4"
            />
            <span className="min-w-0 flex-1 truncate">{option.name}</span>
            <span className="text-xs text-neutral-500 tabular-nums">{option.count}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
