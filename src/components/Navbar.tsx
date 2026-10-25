import { ArrowLeft, Download, Eye, EyeOff, ListFilter, ListPlus, LoaderCircle, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useOfflineCount } from '../hooks/useAvailableChannels';
import { closeCategory } from '../hooks/useCategoryRoute';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { useIPTVStore } from '../store/useIPTVStore';
import { useUIStore } from '../store/useUIStore';
import SourceFilter from './SourceFilter';

/** Desplazamiento mínimo para decidir si se baja o se sube (evita parpadeos con el rebote). */
const SCROLL_DELTA_PX = 8;

export default function Navbar() {
  const searchQuery = useIPTVStore((s) => s.searchQuery);
  const isLoading = useIPTVStore((s) => s.isLoading);
  const searchOpen = useUIStore((s) => s.searchOpen);

  const [scrolled, setScrolled] = useState(false);
  // En el móvil, la fila de chips se esconde al bajar y vuelve al subir.
  const [chipsHidden, setChipsHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 10);
      if (y < 80 || y < lastY - SCROLL_DELTA_PX) setChipsHidden(false);
      else if (y > lastY + SCROLL_DELTA_PX) setChipsHidden(true);
      if (Math.abs(y - lastY) > SCROLL_DELTA_PX) lastY = y;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const solid = scrolled || searchQuery || searchOpen;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-30 pt-[env(safe-area-inset-top)] transition-colors duration-300 ${
        solid ? 'bg-neutral-950/90 shadow-lg backdrop-blur-lg' : 'bg-gradient-to-b from-black/80 via-black/40 to-transparent'
      }`}
    >
      <div className="select-none md:hidden">
        {searchOpen ? (
          <MobileSearchBar />
        ) : (
          <>
            <div className="flex h-14 items-center gap-3 px-4">
              <Logo onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
              {isLoading && (
                <LoaderCircle className="ml-auto h-5 w-5 animate-spin text-neutral-400" aria-label="Cargando lista" />
              )}
            </div>
            <div
              className={`grid transition-[grid-template-rows,opacity] duration-300 ${
                chipsHidden ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
              }`}
            >
              <div className="overflow-hidden">
                <SourceFilter variant="chips" />
              </div>
            </div>
          </>
        )}
      </div>

      <DesktopBar />
    </header>
  );
}

function Logo({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 text-2xl font-black tracking-tighter md:text-3xl"
      aria-label="IPTVFlix, ir al inicio"
    >
      <span className="text-brand">IPTV</span>
      <span className="text-white">FLIX</span>
    </button>
  );
}

/** Barra de la pantalla de búsqueda del móvil. */
function MobileSearchBar() {
  const searchQuery = useIPTVStore((s) => s.searchQuery);
  const setSearchQuery = useIPTVStore((s) => s.setSearchQuery);
  const closeSearch = useUIStore((s) => s.closeSearch);

  return (
    <div className="flex h-14 items-center gap-2 px-2">
      <button
        type="button"
        onClick={closeSearch}
        aria-label="Cerrar búsqueda"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full active:bg-white/10"
      >
        <ArrowLeft className="h-6 w-6" />
      </button>
      <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg bg-neutral-800 px-3">
        <Search className="h-5 w-5 shrink-0 text-neutral-400" />
        <input
          type="search"
          enterKeyHint="search"
          autoFocus
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          placeholder="Buscar canales"
          aria-label="Buscar canales por nombre"
          className="min-w-0 flex-1 bg-transparent text-base text-white placeholder:text-neutral-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Limpiar búsqueda"
            className="-mr-1 flex h-8 w-8 items-center justify-center text-neutral-400"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </label>
    </div>
  );
}

function DesktopBar() {
  const searchQuery = useIPTVStore((s) => s.searchQuery);
  const setSearchQuery = useIPTVStore((s) => s.setSearchQuery);
  const isLoading = useIPTVStore((s) => s.isLoading);
  const channels = useIPTVStore((s) => s.channels);
  const hideUnavailable = useIPTVStore((s) => s.hideUnavailable);
  const toggleHideUnavailable = useIPTVStore((s) => s.toggleHideUnavailable);
  const hiddenCount = useIPTVStore((s) => s.hidden.categories.length + s.hidden.regions.length);
  const openSheet = useUIStore((s) => s.openSheet);
  const offlineCount = useOfflineCount(channels);
  const { canInstall, install } = useInstallPrompt();

  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const showSearch = searchOpen || searchQuery.length > 0;

  const openSearch = () => {
    setSearchOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchOpen(false);
  };

  return (
    <nav className="hidden h-16 items-center gap-6 px-12 md:flex" aria-label="Principal">
      <Logo
        onClick={() => {
          clearSearch();
          closeCategory({ restoreScroll: false });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <SourceFilter variant="tabs" />

      <div className="ml-auto flex items-center gap-5">
        {isLoading && <LoaderCircle className="h-5 w-5 animate-spin text-neutral-400" aria-label="Cargando lista" />}

        <div
          className={`flex items-center gap-2 rounded-sm border transition-all duration-300 ${
            showSearch ? 'border-white/70 bg-black/80 px-2 py-1' : 'border-transparent'
          }`}
        >
          <button type="button" onClick={openSearch} aria-label="Buscar canales" className="text-white">
            <Search className="h-5 w-5" />
          </button>
          {showSearch && (
            <>
              <input
                ref={inputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && clearSearch()}
                onBlur={() => !searchQuery && setSearchOpen(false)}
                placeholder="Canales…"
                aria-label="Buscar canales por nombre"
                className="w-40 bg-transparent text-sm text-white placeholder:text-neutral-500 focus:outline-none lg:w-56 [&::-webkit-search-cancel-button]:hidden"
              />
              {searchQuery && (
                <button type="button" onClick={clearSearch} aria-label="Limpiar búsqueda" className="text-neutral-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={toggleHideUnavailable}
          aria-pressed={hideUnavailable}
          aria-label="Ocultar canales no disponibles"
          title={
            hideUnavailable
              ? `Ocultando ${offlineCount} canales no disponibles. Pulsa para mostrarlos.`
              : `Ocultar los canales no disponibles (${offlineCount} detectados)`
          }
          className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-semibold transition ${
            hideUnavailable ? 'bg-white text-black hover:bg-white/80' : 'text-neutral-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          {hideUnavailable ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          <span className="hidden xl:inline">{hideUnavailable ? 'Solo disponibles' : 'Todos'}</span>
          {offlineCount > 0 && (
            <span className={`rounded-full px-1.5 text-xs tabular-nums ${hideUnavailable ? 'bg-black/15' : 'bg-white/10'}`}>
              {hideUnavailable ? `−${offlineCount}` : offlineCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => openSheet({ type: 'filter' })}
          aria-label="Elegir categorías y comunidades visibles"
          title={hiddenCount ? `${hiddenCount} ocultas. Pulsa para cambiarlo.` : 'Ocultar categorías o comunidades'}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-semibold transition hover:bg-white/10 hover:text-white ${
            hiddenCount ? 'text-white' : 'text-neutral-300'
          }`}
        >
          <ListFilter className="h-5 w-5" />
          <span className="hidden xl:inline">Categorías</span>
          {hiddenCount > 0 && <span className="rounded-full bg-white/10 px-1.5 text-xs tabular-nums">−{hiddenCount}</span>}
        </button>

        {canInstall && (
          <button
            type="button"
            onClick={() => void install()}
            title="Instalar IPTVFlix como aplicación"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-semibold text-neutral-300 transition hover:bg-white/10 hover:text-white"
          >
            <Download className="h-5 w-5" />
            <span className="hidden xl:inline">Instalar</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => openSheet({ type: 'load' })}
          className="flex items-center gap-2 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-hover"
        >
          <ListPlus className="h-5 w-5" />
          Cargar lista
        </button>
      </div>
    </nav>
  );
}
