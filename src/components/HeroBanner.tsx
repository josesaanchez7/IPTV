import { Check, Play, Plus } from 'lucide-react';
import { useIPTVStore } from '../store/useIPTVStore';
import type { Channel } from '../types';
import ChannelLogo, { placeholderBackground } from './ChannelLogo';

type HeroBannerProps = {
  channel: Channel;
  onPlay: (channel: Channel) => void;
};

/** Canal destacado: tarjeta centrada en el móvil, banner a todo lo ancho en escritorio. */
export default function HeroBanner({ channel, onPlay }: HeroBannerProps) {
  const isFavorite = useIPTVStore((s) => s.favorites.includes(channel.id));
  const toggleFavorite = useIPTVStore((s) => s.toggleFavorite);
  const toggle = () => toggleFavorite(channel.id);

  return (
    <>
      <MobileHero channel={channel} isFavorite={isFavorite} onPlay={onPlay} onToggleFavorite={toggle} />
      <DesktopHero channel={channel} isFavorite={isFavorite} onPlay={onPlay} onToggleFavorite={toggle} />
    </>
  );
}

type HeroProps = HeroBannerProps & {
  isFavorite: boolean;
  onToggleFavorite: () => void;
};

/** Fondo: logo ampliado y desenfocado (o gradiente si no hay logo). */
function Backdrop({ channel, className }: { channel: Channel; className: string }) {
  return channel.logo ? (
    <img src={channel.logo} alt="" referrerPolicy="no-referrer" className={`h-full w-full object-cover ${className}`} />
  ) : (
    <div className={`h-full w-full ${className}`} style={{ background: placeholderBackground(channel.name) }} />
  );
}

function LiveBadge() {
  return (
    <span className="flex items-center gap-1.5 rounded bg-brand px-2 py-0.5 text-white">
      <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
      En directo
    </span>
  );
}

function MobileHero({ channel, isFavorite, onPlay, onToggleFavorite }: HeroProps) {
  return (
    <section className="relative isolate px-4 pt-[calc(var(--header-h)+0.5rem)] md:hidden">
      {/* Resplandor del color del canal detrás de la tarjeta, que se funde con el fondo. */}
      <div className="absolute inset-x-0 top-0 -z-10 h-full overflow-hidden [mask-image:linear-gradient(to_bottom,black_40%,transparent)]" aria-hidden="true">
        <Backdrop channel={channel} className="scale-150 opacity-40 blur-3xl saturate-150" />
      </div>

      <div className="relative mx-auto aspect-[4/5] max-h-[62dvh] w-full max-w-sm overflow-hidden rounded-2xl bg-neutral-900 shadow-2xl shadow-black/70 ring-1 ring-white/15">
        <div className="absolute inset-0" aria-hidden="true">
          <Backdrop channel={channel} className="scale-125 opacity-60 blur-2xl saturate-150" />
        </div>
        <button
          type="button"
          data-nav
          onClick={() => onPlay(channel)}
          aria-label={`Ver ${channel.name}`}
          className="absolute inset-x-[18%] top-[12%] h-[38%]"
        >
          <ChannelLogo channel={channel} className="h-full w-full" textClassName="text-7xl" />
        </button>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent px-4 pt-20 pb-4 text-center">
          <h1 className="line-clamp-2 text-2xl leading-tight font-black tracking-tight text-white">{channel.name}</h1>
          <div className="mt-2 flex items-center justify-center gap-2 text-xs font-semibold tracking-wider uppercase">
            <LiveBadge />
            <span className="truncate text-neutral-300">{channel.groups.join(' · ')}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              data-nav
              onClick={() => onPlay(channel)}
              className="flex items-center justify-center gap-2 rounded-md bg-white py-2.5 font-bold text-black transition active:scale-95 active:bg-white/80"
            >
              <Play className="h-5 w-5 fill-current" />
              Ver
            </button>
            <button
              type="button"
              data-nav
              onClick={onToggleFavorite}
              aria-pressed={isFavorite}
              className="flex items-center justify-center gap-2 rounded-md bg-neutral-500/50 py-2.5 font-bold text-white backdrop-blur-sm transition active:scale-95 active:bg-neutral-500/30"
            >
              {isFavorite ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              Mi lista
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function DesktopHero({ channel, isFavorite, onPlay, onToggleFavorite }: HeroProps) {
  return (
    <section className="relative hidden h-[80vh] min-h-[440px] w-full items-end overflow-hidden md:flex">
      <div className="absolute inset-0" aria-hidden="true">
        <Backdrop channel={channel} className="scale-125 opacity-50 blur-3xl saturate-150" />
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-neutral-950/40" />
      </div>

      {/* Logo grande a la derecha en pantallas anchas */}
      <div className="absolute top-1/2 right-[8%] hidden h-[38%] w-[32%] -translate-y-1/2 opacity-90 lg:block">
        <ChannelLogo channel={channel} className="h-full w-full" textClassName="text-8xl" />
      </div>

      <div className="relative z-10 max-w-2xl px-12 pb-48">
        <div className="mb-4 flex items-center gap-3 text-sm font-semibold tracking-wider uppercase">
          <LiveBadge />
          <span className="text-neutral-300">{channel.groups.join(' · ')}</span>
        </div>

        <div className="mb-4 h-20 w-36 lg:hidden">
          <ChannelLogo channel={channel} className="h-full w-full" textClassName="text-3xl" />
        </div>

        <h1 className="text-6xl font-black tracking-tight text-white drop-shadow-lg">{channel.name}</h1>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            data-nav
            onClick={() => onPlay(channel)}
            className="flex items-center gap-2 rounded-md bg-white px-8 py-2.5 text-lg font-bold text-black transition hover:bg-white/80"
          >
            <Play className="h-6 w-6 fill-current" />
            Ver ahora
          </button>
          <button
            type="button"
            data-nav
            onClick={onToggleFavorite}
            aria-pressed={isFavorite}
            className="flex items-center gap-2 rounded-md bg-neutral-500/60 px-6 py-2.5 text-lg font-bold text-white backdrop-blur-sm transition hover:bg-neutral-500/40"
          >
            {isFavorite ? <Check className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
            Mi lista
          </button>
        </div>
      </div>
    </section>
  );
}
