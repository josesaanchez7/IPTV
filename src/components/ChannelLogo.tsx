import { useState } from 'react';
import type { Channel } from '../types';

function hashHue(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}

function initials(name: string): string {
  const words = name
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .split(/[\s\-_.]+/)
    .filter(Boolean);
  const [first = '?', second] = words;
  const letters = second ? first.charAt(0) + second.charAt(0) : first.slice(0, 2);
  return letters.toUpperCase();
}

export function placeholderBackground(name: string): string {
  const hue = hashHue(name);
  return `linear-gradient(135deg, hsl(${hue} 55% 32%), hsl(${(hue + 50) % 360} 65% 14%))`;
}

/**
 * Logo del canal con fallback a un placeholder (iniciales sobre un gradiente estable
 * derivado del nombre) cuando no hay logo o la imagen no carga.
 * El tamaño lo decide `className`.
 */
type ChannelLogoProps = {
  channel: Channel;
  /** Tamaño y posición de la caja del logo. */
  className?: string;
  /** Tamaño de las iniciales del placeholder. */
  textClassName?: string;
};

export default function ChannelLogo({ channel, className = '', textClassName = 'text-2xl' }: ChannelLogoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const { logo } = channel;

  if (logo && failedSrc !== logo) {
    return (
      <div className={className}>
        <img
          src={logo}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setFailedSrc(logo)}
          className="h-full w-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-md ${className}`}
      style={{ background: placeholderBackground(channel.name) }}
      aria-hidden="true"
    >
      <span className={`font-black tracking-tight text-white/90 select-none ${textClassName}`}>
        {initials(channel.name)}
      </span>
    </div>
  );
}
