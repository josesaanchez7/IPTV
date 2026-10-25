import { TriangleAlert, X } from 'lucide-react';
import { useEffect } from 'react';
import { useIPTVStore } from '../store/useIPTVStore';

const AUTO_DISMISS_MS = 7000;

/**
 * Aviso flotante. `notice` es un texto o `{ message, action: { label, run } }`;
 * los avisos con acción no se cierran solos.
 */
export default function Toast() {
  const notice = useIPTVStore((s) => s.notice);
  const dismissNotice = useIPTVStore((s) => s.dismissNotice);
  const message = typeof notice === 'string' ? notice : notice?.message;
  const action = typeof notice === 'string' ? null : notice?.action;

  useEffect(() => {
    if (!notice || action) return;
    const timer = setTimeout(dismissNotice, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notice, action, dismissNotice]);

  if (!notice) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-[calc(var(--bottom-nav-h)+0.75rem)] left-1/2 md:bottom-6 z-40 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-start gap-3 rounded-lg border border-white/10 bg-neutral-900/95 p-4 shadow-2xl backdrop-blur"
    >
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
      <div className="flex-1">
        <p className="text-sm text-neutral-200">{message}</p>
        {action && (
          <button
            type="button"
            onClick={action.run}
            className="mt-3 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-black hover:bg-white/80"
          >
            {action.label}
          </button>
        )}
      </div>
      <button type="button" onClick={dismissNotice} aria-label="Cerrar aviso" className="-m-2 p-2 text-neutral-400 hover:text-white">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
