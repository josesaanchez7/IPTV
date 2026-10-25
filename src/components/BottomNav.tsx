import { Ellipsis, Heart, House, Search, type LucideIcon } from 'lucide-react';
import { FAVORITES_CATEGORY } from '../config';
import { closeCategory, useCategoryRoute } from '../hooks/useCategoryRoute';
import { afterOverlaysClose } from '../hooks/useOverlayHistory';
import { useUIStore } from '../store/useUIStore';

type Tab = 'home' | 'search' | 'favorites' | 'more';

/**
 * Barra de pestañas inferior, solo en el móvil (en escritorio todo está en la barra superior).
 * Pulsar "Inicio" estando ya en el inicio sube arriba del todo, como en las apps nativas.
 */
type BottomNavProps = {
  onOpenFavorites: () => void;
};

export default function BottomNav({ onOpenFavorites }: BottomNavProps) {
  const searchOpen = useUIStore((s) => s.searchOpen);
  const sheetType = useUIStore((s) => s.sheet?.type);
  const { openSearch, closeSearch, openSheet } = useUIStore.getState();
  const categoryName = useCategoryRoute();

  let active: Tab = 'home';
  if (sheetType === 'more' || sheetType === 'filter' || sheetType === 'load') active = 'more';
  else if (searchOpen) active = 'search';
  else if (categoryName === FAVORITES_CATEGORY) active = 'favorites';

  /** Cierra la búsqueda (si está abierta) y después navega. */
  const leaveSearch = (navigate: () => void) => {
    if (!useUIStore.getState().searchOpen) return navigate();
    closeSearch();
    afterOverlaysClose(navigate);
  };

  const goHome = () =>
    leaveSearch(() => {
      if (categoryName) closeCategory({ restoreScroll: false });
      window.scrollTo({ top: 0, behavior: categoryName ? 'instant' : 'smooth' });
    });

  const tabs: { id: Tab; label: string; Icon: LucideIcon; onClick: () => void }[] = [
    { id: 'home', label: 'Inicio', Icon: House, onClick: goHome },
    {
      id: 'search',
      label: 'Buscar',
      Icon: Search,
      onClick: () => {
        if (searchOpen) return;
        openSearch();
        window.scrollTo({ top: 0 });
      },
    },
    {
      id: 'favorites',
      label: 'Mi lista',
      Icon: Heart,
      onClick: () => leaveSearch(() => categoryName !== FAVORITES_CATEGORY && onOpenFavorites()),
    },
    { id: 'more', label: 'Más', Icon: Ellipsis, onClick: () => openSheet({ type: 'more' }) },
  ];

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-neutral-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg select-none md:hidden"
    >
      <ul className="flex h-14">
        {tabs.map(({ id, label, Icon, onClick }) => {
          const isActive = active === id;
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={onClick}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors active:scale-95 ${
                  isActive ? 'text-white' : 'text-neutral-500'
                }`}
              >
                <Icon className={`h-6 w-6 ${isActive && id === 'favorites' ? 'fill-current' : ''}`} strokeWidth={isActive ? 2.4 : 1.8} />
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
