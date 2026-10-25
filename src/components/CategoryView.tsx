import { Search, X } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { FAVORITES_CATEGORY, FOOTBALL_CATEGORY, RECENTS_CATEGORY } from '../config';
import { closeCategory } from '../hooks/useCategoryRoute';
import { filterChannels } from '../lib/playlist';
import type { Program } from '../lib/guide';
import type { Channel, PlayChannelHandler } from '../types';
import ChannelGrid from './ChannelGrid';

/** Todos los canales de una categoría, con filtro por nombre dentro de ella. */
type CategoryViewProps = {
  name: string;
  channels: Channel[];
  onPlay: PlayChannelHandler;
  highlights?: ReadonlyMap<string, Program>;
};

export default function CategoryView({ name, channels, onPlay, highlights }: CategoryViewProps) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => filterChannels(channels, deferredQuery), [channels, deferredQuery]);

  let emptyMessage = 'No hay canales disponibles en esta categoría.';
  if (name === FOOTBALL_CATEGORY) emptyMessage = 'No hay partidos en abierto ahora mismo.';
  if (query.trim()) emptyMessage = `Ningún canal de ${name} coincide con «${query.trim()}».`;
  else if (name === RECENTS_CATEGORY) emptyMessage = 'Aún no has visto ningún canal.';
  else if (name === FAVORITES_CATEGORY) emptyMessage = 'Aún no tienes favoritos. Mantén pulsado un canal (o pulsa su corazón) para añadirlo.';

  return (
    <ChannelGrid
      title={name}
      channels={filtered}
      onPlay={onPlay}
      onBack={() => closeCategory()}
      showGroup={false}
      highlights={highlights}
      emptyMessage={emptyMessage}
      toolbar={
        <label className="flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 transition focus-within:border-neutral-400">
          <Search className="h-4 w-4 shrink-0 text-neutral-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
            placeholder={`Filtrar en ${name}…`}
            aria-label={`Filtrar canales de ${name}`}
            className="min-w-0 flex-1 bg-transparent text-base placeholder:text-neutral-500 focus:outline-none md:text-sm [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Limpiar filtro" className="text-neutral-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
      }
    />
  );
}
