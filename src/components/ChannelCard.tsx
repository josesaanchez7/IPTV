import { Heart, Play, WifiOff } from 'lucide-react';
import { useEffect } from 'react';
import { useLongPress } from '../hooks/useLongPress';
import { useNowNext, useNowSeconds } from '../hooks/useNowNext';
import { formatClock, type Program } from '../lib/guide';
import { useIPTVStore } from '../store/useIPTVStore';
import { cancelCheck, requestCheck, useStreamStatus } from '../store/useStreamStatus';
import { useUIStore } from '../store/useUIStore';
import type { Channel } from '../types';
import { badgeLabels, QualityBadge, StatusBadges } from './ChannelBadges';
import ChannelLogo from './ChannelLogo';
import { ProgramProgress } from './Guide';

type ChannelCardProps = {
  channel: Channel;
  onPlay: (channel: Channel) => void;
  /** Mostrar las categorías bajo el nombre (útil fuera de una fila de categoría). */
  showGroup?: boolean;
  /** Programa a mostrar en lugar del que se emite ahora (p. ej. el partido de la fila "Fútbol hoy"). */
  highlight?: Program;
  className?: string;
};

export default function ChannelCard({ channel, onPlay, showGroup = false, highlight, className = '' }: ChannelCardProps) {
  const isFavorite = useIPTVStore((s) => s.favorites.includes(channel.id));
  const toggleFavorite = useIPTVStore((s) => s.toggleFavorite);
  const offline = useStreamStatus((s) => s.statuses[channel.id]?.status === 'offline');
  const badgeText = badgeLabels(channel.badges).join(', ');
  const { now: current, progress: currentProgress } = useNowNext(channel);
  const nowSeconds = useNowSeconds();
  // Con `highlight`: "20:45 · Real Madrid - Villarreal", y barra de progreso solo si ya ha empezado.
  const program = highlight ?? current;
  const programLabel = highlight ? `${formatClock(highlight.start)} · ${highlight.title}` : (current?.title ?? '');
  const progress = highlight
    ? Math.max(0, (nowSeconds - highlight.start) / Math.max(1, highlight.end - highlight.start))
    : currentProgress;
  // En el móvil no hay hover: una pulsación larga abre las acciones (ver, Mi lista).
  const longPress = useLongPress(() =>
    useUIStore.getState().openSheet({ type: 'channel', channel, play: () => onPlay(channel) }),
  );

  useEffect(() => {
    requestCheck(channel);
    return () => cancelCheck(channel);
  }, [channel]);

  return (
    <div
      {...longPress}
      className={`group/card @container relative aspect-video has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-white shrink-0 overflow-hidden rounded-md bg-neutral-800 shadow-md ring-1 ring-white/5 transition duration-300 ease-out select-none [-webkit-touch-callout:none] hover:z-20 hover:scale-110 hover:shadow-2xl hover:shadow-black/80 hover:ring-white/20 focus-within:z-20 focus-within:scale-110 pointer-coarse:duration-150 pointer-coarse:focus-within:scale-100 pointer-coarse:active:scale-95 ${className}`}
    >
      <button
        type="button"
        data-nav
        onClick={() => onPlay(channel)}
        aria-label={`Ver ${channel.name}${badgeText ? ` (${badgeText})` : ''}${program ? `, ${highlight ? 'a las' : 'ahora:'} ${programLabel}` : ''}${offline ? ' (no disponible ahora)' : ''}`}
        draggable={false}
        className={`absolute inset-0 cursor-pointer transition focus-visible:outline-none ${
          offline ? 'opacity-50 grayscale group-hover/card:opacity-80' : ''
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-700/60 to-neutral-900" />
        <ChannelLogo
          channel={channel}
          className="absolute inset-0 px-[18%] pt-[10%] pb-[22%]"
          textClassName="text-3xl"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-3 pt-8 pb-2 text-left">
          <StatusBadges badges={channel.badges} compact />
          <div className="mt-1 flex items-center gap-1.5">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{channel.name}</p>
            <QualityBadge quality={channel.badges.quality} />
          </div>
          {program && <p className="truncate text-xs text-neutral-300">{programLabel}</p>}
          {showGroup && <p className="truncate text-xs text-neutral-400">{channel.groups.join(' · ')}</p>}
        </div>
        {program && progress > 0 && <ProgramProgress progress={progress} className="absolute inset-x-0 bottom-0 h-0.5" />}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover/card:opacity-100 group-focus-within/card:opacity-100 pointer-coarse:hidden">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-black shadow-lg">
            <Play className="h-5 w-5 translate-x-px fill-current" />
          </span>
        </div>
      </button>

      {offline && (
        <span className="pointer-events-none absolute top-1.5 left-1.5 flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-300">
          <WifiOff className="h-3 w-3" />
          No disponible
        </span>
      )}

      <button
        type="button"
        onClick={() => toggleFavorite(channel.id)}
        aria-label={isFavorite ? `Quitar ${channel.name} de favoritos` : `Añadir ${channel.name} a favoritos`}
        aria-pressed={isFavorite}
        className={`absolute top-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition hover:bg-black/80 ${
          // En táctil el corazón vacío no se ve ni se puede tocar sin querer: se usa la pulsación larga.
          isFavorite ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 pointer-coarse:hidden'
        }`}
      >
        <Heart className={`h-4 w-4 ${isFavorite ? 'fill-brand text-brand' : 'text-white'}`} />
      </button>
    </div>
  );
}
