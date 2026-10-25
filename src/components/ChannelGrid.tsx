import { ArrowLeft, SearchX } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useAvailableChannels } from '../hooks/useAvailableChannels';
import { useInView } from '../hooks/useInView';
import type { Program } from '../lib/guide';
import type { Channel, PlayChannelHandler } from '../types';
import ChannelCard from './ChannelCard';

const GRID_PAGE_SIZE = 60;

/**
 * Cuadrícula de canales a página completa (resultados de búsqueda y vista de categoría).
 * Pinta las tarjetas en tramos de GRID_PAGE_SIZE según se hace scroll, así que aguanta
 * categorías de miles de canales.
 */
type ChannelGridProps = {
  title: string;
  channels: Channel[];
  onPlay: PlayChannelHandler;
  emptyMessage: string;
  /** Si se indica, muestra una flecha para volver. */
  onBack?: () => void;
  /** Contenido a la derecha del título (p. ej. un filtro). */
  toolbar?: ReactNode;
  showGroup?: boolean;
  /** Programa a destacar en la tarjeta de cada canal (por id de canal); ver `ChannelCard`. */
  highlights?: ReadonlyMap<string, Program>;
};

export default function ChannelGrid({
  title,
  channels: allChannels,
  onPlay,
  emptyMessage,
  onBack,
  toolbar,
  showGroup = true,
  highlights,
}: ChannelGridProps) {
  const channels = useAvailableChannels(allChannels);
  const [visibleCount, setVisibleCount] = useState(GRID_PAGE_SIZE);
  const [sentinelRef, sentinelVisible] = useInView({ rootMargin: '800px 0px', once: false });

  useEffect(() => {
    if (sentinelVisible && visibleCount < channels.length) {
      setVisibleCount((c) => c + GRID_PAGE_SIZE);
    }
  }, [sentinelVisible, visibleCount, channels.length]);

  const shown = channels.slice(0, visibleCount);

  return (
    <section className="px-4 pt-[calc(var(--header-h)+1rem)] pb-8 md:px-12 md:pt-24 md:pb-16">
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-3 md:mb-6 md:gap-y-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver al inicio"
            title="Volver"
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
        )}
        <h1 className="text-xl font-bold md:text-3xl">
          {title} <span className="text-base font-normal text-neutral-500">({channels.length})</span>
        </h1>
        {toolbar && <div className="w-full sm:ml-auto sm:w-72">{toolbar}</div>}
      </div>

      {channels.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center text-neutral-400">
          <SearchX className="h-12 w-12" />
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-3 md:gap-y-6 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {shown.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                showGroup={showGroup}
                highlight={highlights?.get(channel.id)}
                onPlay={(c) => onPlay(c, channels)}
              />
            ))}
          </div>
          {visibleCount < channels.length && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
        </>
      )}
    </section>
  );
}
