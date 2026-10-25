import { Clock, GlobeLock } from 'lucide-react';
import type { ChannelBadges as Badges } from '../types';

const PART_TIME = 'Emisión puntual';
const GEO_BLOCKED = 'Bloqueado fuera de España';

/** Los distintivos en texto, para `aria-label` y el reproductor. */
export function badgeLabels(badges: Badges): string[] {
  return [badges.quality, badges.partTime && PART_TIME, badges.geoBlocked && GEO_BLOCKED].filter(
    (label): label is string => Boolean(label),
  );
}

/** Calidad (HD/FHD/4K) como la marca pequeña con borde de Netflix. */
export function QualityBadge({ quality }: { quality: Badges['quality'] }) {
  if (!quality) return null;
  return (
    <span className="shrink-0 rounded-[3px] border border-white/60 px-1 text-[10px] leading-4 font-bold tracking-wide text-white/90">
      {quality}
    </span>
  );
}

/**
 * "Emisión puntual" y "Bloqueado fuera de España". Con `compact`, dentro de una tarjeta: solo el
 * icono si la tarjeta es estrecha y el texto completo cuando hay sitio (consulta de contenedor:
 * la tarjeta lleva `@container`).
 */
type StatusBadgesProps = {
  badges: Badges;
  compact?: boolean;
};

export function StatusBadges({ badges, compact = false }: StatusBadgesProps) {
  const items = [
    badges.partTime && { label: PART_TIME, Icon: Clock },
    badges.geoBlocked && { label: GEO_BLOCKED, Icon: GlobeLock },
  ].filter((item) => item !== false);
  if (!items.length) return null;

  return (
    <span className="flex flex-wrap gap-1">
      {items.map(({ label, Icon }) => (
        <span
          key={label}
          title={label}
          className="flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] leading-3 font-semibold text-neutral-200"
        >
          <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className={compact ? 'sr-only @[11rem]:not-sr-only' : ''}>{label}</span>
        </span>
      ))}
    </span>
  );
}
