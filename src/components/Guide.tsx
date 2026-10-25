import { X } from 'lucide-react';
import { useNowNext, useChannelPrograms, useNowSeconds } from '../hooks/useNowNext';
import { formatClock } from '../lib/guide';
import type { Channel } from '../types';

/** Barra fina de lo que lleva emitido el programa actual (0-1). */
export function ProgramProgress({ progress, className = '' }: { progress: number; className?: string }) {
  return (
    <div className={`h-1 bg-white/25 ${className}`} aria-hidden="true">
      <div className="h-full bg-brand" style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }} />
    </div>
  );
}

/** "Ahora: Telediario · hasta 15:45" y "Después: …", para la barra del reproductor y los paneles. */
export function NowNextText({ channel }: { channel: Channel }) {
  const { now, next } = useNowNext(channel);
  if (!now && !next) return null;
  return (
    <p className="truncate text-sm text-neutral-300">
      {now && (
        <>
          <span className="font-semibold text-white">{now.title}</span>
          <span className="text-neutral-400"> · hasta {formatClock(now.end)}</span>
        </>
      )}
      {next && (
        <span className="text-neutral-400">
          {now ? ' · Después: ' : 'Después: '}
          {next.title} ({formatClock(next.start)})
        </span>
      )}
    </p>
  );
}

type GuidePanelProps = {
  channel: Channel;
  onClose: () => void;
};

/**
 * Panel lateral con la programación del canal: lo que se está emitiendo (con su progreso) y lo
 * que viene después. La sinopsis, si la guía la trae, solo se muestra en los dos primeros.
 */
export function GuidePanel({ channel, onClose }: GuidePanelProps) {
  const programs = useChannelPrograms(channel);
  const nowSeconds = useNowSeconds();
  const upcoming = (programs ?? []).filter((p) => p.end > nowSeconds).slice(0, 40);

  return (
    <aside
      aria-label="Programación del canal"
      className="absolute inset-y-0 right-0 z-10 flex w-full max-w-xs flex-col border-l border-white/10 bg-neutral-950/95 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] backdrop-blur md:relative"
    >
      <div className="flex items-center gap-2 border-b border-white/10 p-3">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">Programación · {channel.name}</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar programación" className="text-neutral-400 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto py-1">
        {upcoming.map((program, index) => {
          const isNow = program.start <= nowSeconds;
          return (
            <li key={`${program.start}-${program.title}`} className={`px-3 py-2.5 ${isNow ? 'bg-brand/15' : ''}`}>
              <div className="flex items-baseline gap-3">
                <span className="w-24 shrink-0 text-xs text-neutral-400 tabular-nums">
                  {formatClock(program.start)}–{formatClock(program.end)}
                </span>
                <span className={`min-w-0 text-sm ${isNow ? 'font-semibold text-white' : 'text-neutral-200'}`}>
                  {program.title}
                </span>
              </div>
              {isNow && (
                <ProgramProgress
                  progress={(nowSeconds - program.start) / Math.max(1, program.end - program.start)}
                  className="mt-2 ml-27 rounded-full"
                />
              )}
              {index < 2 && program.description && (
                <p className="mt-1.5 ml-27 line-clamp-4 text-xs text-neutral-400">{program.description}</p>
              )}
            </li>
          );
        })}
        {!upcoming.length && (
          <li className="px-3 py-6 text-center text-sm text-neutral-500">No hay programación para este canal.</li>
        )}
      </ul>
    </aside>
  );
}
