import { X } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';

/** Arrastrando el asa más de esto hacia abajo, el panel se cierra. */
const DRAG_CLOSE_PX = 90;

/**
 * Panel que sube desde abajo en el móvil (se cierra arrastrando el asa hacia abajo, tocando
 * fuera o con "atrás") y ventana centrada en escritorio. Usa `<dialog>` modal, así que el foco
 * queda dentro y Escape lo cierra.
 */
type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
};

export default function BottomSheet({ open, onClose, label, children }: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dragStart = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
    setDragY(0);
  }, [open]);

  const onDragStart = (e: PointerEvent<HTMLDivElement>) => {
    dragStart.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: PointerEvent) => {
    if (dragStart.current !== null) setDragY(Math.max(0, e.clientY - dragStart.current));
  };
  const onDragEnd = () => {
    if (dragStart.current === null) return;
    dragStart.current = null;
    if (dragY > DRAG_CLOSE_PX) onClose();
    else setDragY(0);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      className="mx-0 mt-auto mb-0 flex max-h-[88dvh] w-full max-w-none flex-col rounded-t-2xl bg-neutral-900 p-0 pb-[env(safe-area-inset-bottom)] text-neutral-100 shadow-2xl ring-1 ring-white/10 transition-transform duration-300 ease-out backdrop:bg-black/70 backdrop:backdrop-blur-sm starting:open:translate-y-full md:m-auto md:max-h-[85vh] md:w-[calc(100%-2rem)] md:max-w-lg md:rounded-xl md:pb-0 md:transition-[opacity,scale] md:starting:open:translate-y-0 md:starting:open:scale-95 md:starting:open:opacity-0 [&:not([open])]:hidden"
    >
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        className="flex shrink-0 touch-none justify-center pt-2.5 pb-1 md:hidden"
        aria-hidden="true"
      >
        <span className="h-1 w-10 rounded-full bg-white/25" />
      </div>
      {open && children}
    </dialog>
  );
}

/** Cabecera estándar de un panel: título, texto opcional y botón de cerrar. */
type SheetHeaderProps = {
  title: string;
  description?: string;
  onClose: () => void;
};

export function SheetHeader({ title, description, onClose }: SheetHeaderProps) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-4 px-5 pt-2 pb-4 md:px-6 md:pt-6">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        {description && <p className="mt-1 text-sm text-neutral-400">{description}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-white/10 hover:text-white"
      >
        <X className="h-6 w-6" />
      </button>
    </div>
  );
}
