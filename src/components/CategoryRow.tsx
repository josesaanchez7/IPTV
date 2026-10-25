import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ROW_PAGE_SIZE } from '../config';
import { useAvailableChannels } from '../hooks/useAvailableChannels';
import { useInView } from '../hooks/useInView';
import type { Program } from '../lib/guide';
import type { Channel, PlayChannelHandler } from '../types';
import ChannelCard from './ChannelCard';

// En el móvil la tercera tarjeta asoma por el borde, para que se vea que la fila se desliza.
const CARD_WIDTH = 'w-[40vw] sm:w-48 md:w-56 xl:w-64';

/**
 * Fila horizontal de canales. Rendimiento con listas grandes:
 * - no pinta nada hasta acercarse al viewport (skeleton de altura fija),
 * - pinta las tarjetas en tramos de ROW_PAGE_SIZE según se hace scroll horizontal.
 * Con "Ocultar no disponibles" activo, la fila desaparece si se queda vacía.
 */
type CategoryRowProps = {
  title: string;
  channels: Channel[];
  onPlay: PlayChannelHandler;
  /** Abre la vista de la categoría completa. */
  onOpen: () => void;
  /** Programa a destacar en la tarjeta de cada canal (por id de canal); ver `ChannelCard`. */
  highlights?: ReadonlyMap<string, Program>;
};

export default function CategoryRow({ title, channels: allChannels, onPlay, onOpen, highlights }: CategoryRowProps) {
  const channels = useAvailableChannels(allChannels);
  const [rowRef, rowVisible] = useInView({ rootMargin: '400px 0px' });
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [sentinelRef, sentinelVisible] = useInView({
    root: scroller,
    rootMargin: '0px 600px 0px 0px',
    once: false,
  });
  const [visibleCount, setVisibleCount] = useState(ROW_PAGE_SIZE);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  useEffect(() => {
    if (sentinelVisible && visibleCount < channels.length) {
      setVisibleCount((c) => c + ROW_PAGE_SIZE);
    }
  }, [sentinelVisible, visibleCount, channels.length]);

  const updateArrows = useCallback(() => {
    if (!scroller) return;
    const { scrollLeft, scrollWidth, clientWidth } = scroller;
    setCanScroll({ left: scrollLeft > 4, right: scrollLeft + clientWidth < scrollWidth - 4 });
  }, [scroller]);

  useEffect(() => {
    if (!scroller) return;
    updateArrows();
    const observer = new ResizeObserver(updateArrows);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [scroller, updateArrows, visibleCount, channels.length]);

  const scrollBy = (direction: 1 | -1) => {
    scroller?.scrollBy({ left: direction * scroller.clientWidth * 0.85, behavior: 'smooth' });
  };

  if (!channels.length) return null;

  const shown = channels.slice(0, visibleCount);

  return (
    <section ref={rowRef} className="group/row relative" aria-label={title}>
      <h2 className="px-4 md:px-12">
        <button
          type="button"
          onClick={onOpen}
          title={`Ver todos los canales de ${title}`}
          className="group/title flex items-baseline gap-2 text-left text-lg font-bold text-neutral-100 active:opacity-70 md:text-xl md:active:opacity-100"
        >
          {title}
          <span className="text-sm font-normal text-neutral-500">{channels.length}</span>
          <span className="flex items-center self-center text-sm font-semibold text-neutral-300 transition-all duration-300 group-hover/title:text-white md:-translate-x-2 md:opacity-0 md:group-hover/row:translate-x-0 md:group-hover/row:opacity-100 md:group-focus-visible/title:translate-x-0 md:group-focus-visible/title:opacity-100">
            <span className="hidden md:inline">Ver todo</span>
            <ChevronRight className="h-5 w-5 transition-transform group-hover/title:translate-x-0.5 md:h-4 md:w-4" />
          </span>
        </button>
      </h2>

      {!rowVisible ? (
        <div className="flex gap-2 overflow-hidden px-4 py-3 md:px-12 md:py-6">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={`${CARD_WIDTH} aspect-video shrink-0 animate-pulse rounded-md bg-neutral-800/70`} />
          ))}
        </div>
      ) : (
        <div className="relative">
          <div
            ref={setScroller}
            onScroll={updateArrows}
            className="scrollbar-hide flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto overscroll-x-contain px-4 py-3 md:scroll-px-12 md:px-12 md:py-6"
          >
            {shown.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                onPlay={(c) => onPlay(c, channels)}
                highlight={highlights?.get(channel.id)}
                className={`${CARD_WIDTH} snap-start`}
              />
            ))}
            {visibleCount < channels.length && (
              <div ref={sentinelRef} className={`${CARD_WIDTH} aspect-video shrink-0 rounded-md bg-neutral-800/50`} />
            )}
          </div>

          {canScroll.left && (
            <ArrowButton side="left" onClick={() => scrollBy(-1)} label={`Anterior en ${title}`} />
          )}
          {canScroll.right && (
            <ArrowButton side="right" onClick={() => scrollBy(1)} label={`Siguiente en ${title}`} />
          )}
        </div>
      )}
    </section>
  );
}

type ArrowButtonProps = { side: 'left' | 'right'; onClick: () => void; label: string };

function ArrowButton({ side, onClick, label }: ArrowButtonProps) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute inset-y-6 z-30 hidden w-4 items-center justify-center bg-black/60 text-white opacity-0 transition group-hover/row:opacity-100 hover:bg-black/80 focus-visible:opacity-100 md:flex md:w-12 ${
        side === 'left' ? 'left-0 rounded-r-md' : 'right-0 rounded-l-md'
      }`}
    >
      <Icon className="h-8 w-8 transition-transform hover:scale-125" />
    </button>
  );
}
