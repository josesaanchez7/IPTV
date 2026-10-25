import { Check, Settings } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { QualityLevel } from '../hooks/useHls';

type QualityMenuProps = {
  levels: QualityLevel[];
  /** Nivel de hls.js que se está reproduciendo ahora (para decir a cuánto llega la automática). */
  activeLevel: number;
  /** Resolución fijada (alto) o null si es automática. */
  preferredHeight: number | null;
  onSelect: (height: number | null) => void;
};

/**
 * Selector de calidad del reproductor: "Automática" (la que aguante la conexión) o una resolución
 * concreta. Solo aparece si el stream ofrece más de una. La elección se recuerda para el resto de canales.
 */
export default function QualityMenu({ levels, activeLevel, preferredHeight, onSelect }: QualityMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); // que Esc cierre solo el menú y no el reproductor
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  if (levels.length < 2) return null;

  // Qué opción queda marcada: la fijada, o la más alta que no supere la preferencia en este canal.
  const fixed = preferredHeight === null ? null : (levels.find((l) => l.height <= preferredHeight) ?? levels[levels.length - 1]);
  const playingHeight = levels.find((l) => l.index === activeLevel)?.height;

  const choose = (height: number | null) => {
    onSelect(height);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Calidad de vídeo"
        title="Calidad de vídeo"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:scale-110 hover:bg-white/10 active:bg-white/15 md:h-10 md:w-10"
      >
        <Settings className="h-6 w-6" />
      </button>

      {open && (
        <ul
          role="menu"
          aria-label="Calidad de vídeo"
          className="absolute right-0 bottom-full z-20 mb-2 min-w-44 overflow-hidden rounded-lg bg-neutral-900/95 py-1 shadow-2xl ring-1 ring-white/15 backdrop-blur"
        >
          <Option selected={fixed === null} onClick={() => choose(null)}>
            Automática{playingHeight ? ` (${playingHeight}p)` : ''}
          </Option>
          {levels.map((level) => (
            <Option key={level.index} selected={fixed?.index === level.index} onClick={() => choose(level.height)}>
              {level.height}p
            </Option>
          ))}
        </ul>
      )}
    </div>
  );
}

type OptionProps = {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function Option({ selected, onClick, children }: OptionProps) {
  return (
    <li role="none">
      <button
        type="button"
        role="menuitemradio"
        aria-checked={selected}
        onClick={onClick}
        className="flex w-full items-center justify-between gap-6 px-4 py-2.5 text-left text-sm hover:bg-white/10 active:bg-white/15"
      >
        <span className={selected ? 'font-semibold text-white' : 'text-neutral-300'}>{children}</span>
        {selected && <Check className="h-4 w-4 text-brand" />}
      </button>
    </li>
  );
}
