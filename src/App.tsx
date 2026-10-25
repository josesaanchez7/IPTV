import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import BottomNav from './components/BottomNav';
import CategoryRow from './components/CategoryRow';
import CategoryView from './components/CategoryView';
import ChannelGrid from './components/ChannelGrid';
import HeroBanner from './components/HeroBanner';
import LazyPlayer from './components/LazyPlayer';
import Navbar from './components/Navbar';
import Sheets from './components/Sheets';
import StatusScreen from './components/StatusScreen';
import Toast from './components/Toast';
import { FAVORITES_CATEGORY, FOOTBALL_CATEGORY, RECENTS_CATEGORY } from './config';
import { closeCategory, consumeRestoreScroll, openCategory, useCategoryRoute } from './hooks/useCategoryRoute';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useOverlayHistory } from './hooks/useOverlayHistory';
import { useNowSeconds } from './hooks/useNowNext';
import { footballToday } from './lib/football';
import { filterByProgram, filterChannels } from './lib/playlist';
import { programsFor, useGuide } from './store/useGuide';
import { useIPTVStore } from './store/useIPTVStore';
import { isKnownOffline } from './store/useStreamStatus';
import { useUIStore } from './store/useUIStore';
import type { Channel } from './types';

export default function App() {
  const status = useIPTVStore((s) => s.status);
  const channels = useIPTVStore((s) => s.channels);
  const categories = useIPTVStore((s) => s.categories);
  const favorites = useIPTVStore((s) => s.favorites);
  const recents = useIPTVStore((s) => s.recents);
  const searchQuery = useIPTVStore((s) => s.searchQuery);
  const playlistVersion = useIPTVStore((s) => s.playlistVersion);
  const hasActiveChannel = useIPTVStore((s) => s.activeChannel !== null);
  const playChannel = useIPTVStore((s) => s.playChannel);
  const searchOpen = useUIStore((s) => s.searchOpen);
  const categoryName = useCategoryRoute();
  const homeScroll = useRef(0);

  useOverlayHistory();
  useKeyboardNavigation();

  useEffect(() => {
    // El scroll al cambiar de vista lo gestiona la app (ver más abajo).
    window.history.scrollRestoration = 'manual';
    useIPTVStore.getState().init();
  }, []);

  const deferredQuery = useDeferredValue(searchQuery);

  // Ids guardados (favoritos, recientes) → canales de ahora, en el mismo orden. También por las URLs
  // alternativas: un id guardado puede ser una copia que ahora está unida a otro canal. Los que ya
  // no existen (otra lista, categoría oculta) se omiten.
  const byAnyId = useMemo(() => {
    const map = new Map<string, Channel>();
    for (const c of channels) {
      for (const key of [c.id, ...c.sources]) if (!map.has(key)) map.set(key, c);
    }
    return map;
  }, [channels]);
  const resolve = (ids: string[]) => [
    ...new Set(ids.map((id) => byAnyId.get(id)).filter((c): c is Channel => c !== undefined)),
  ];
  const favoriteChannels = useMemo(() => resolve(favorites), [byAnyId, favorites]);
  const recentChannels = useMemo(() => resolve(recents), [byAnyId, recents]);

  // Se busca por nombre del canal y también por lo que emite ahora (la guía): "telediario", "fútbol"…
  const guide = useGuide((s) => s.programs);
  const nowSeconds = useNowSeconds();
  // Partidos de fútbol en abierto ahora o más tarde hoy (ver `lib/football.ts`): el partido de cada canal.
  const footballMatches = useMemo(
    () => footballToday(channels, nowSeconds, (c) => programsFor(guide, c)),
    [channels, guide, nowSeconds],
  );
  const footballChannels = useMemo(
    () =>
      channels
        .filter((c) => footballMatches.has(c.id))
        .sort((a, b) => (footballMatches.get(a.id)?.start ?? 0) - (footballMatches.get(b.id)?.start ?? 0)),
    [channels, footballMatches],
  );

  const searchResults = useMemo(() => {
    if (!deferredQuery.trim()) return null;
    const byName = filterChannels(channels, deferredQuery);
    const byProgram = filterByProgram(channels, deferredQuery, nowSeconds, (c) => programsFor(guide, c));
    return [...new Set([...byName, ...byProgram])];
  }, [channels, deferredQuery, guide, nowSeconds]);

  const categoryChannels = useMemo(() => {
    if (!categoryName) return null;
    if (categoryName === FAVORITES_CATEGORY) return favoriteChannels;
    if (categoryName === RECENTS_CATEGORY) return recentChannels;
    if (categoryName === FOOTBALL_CATEGORY) return footballChannels;
    return categories.find((c) => c.name === categoryName)?.channels ?? null;
  }, [categoryName, categories, favoriteChannels, recentChannels, footballChannels]);

  // Destacado: se evitan los canales que ya se sabe que están caídos (según la caché al cargar).
  const featured = useMemo(() => {
    const candidates = [...favoriteChannels, ...channels.filter((c) => c.logo), ...channels];
    return candidates.find((c) => !isKnownOffline(c.id)) ?? channels[0];
  }, [favoriteChannels, channels]);

  // Categoría inexistente (URL antigua o la lista nueva no la tiene): de vuelta al inicio.
  useEffect(() => {
    if (status === 'ready' && categoryName && !categoryChannels) closeCategory({ restoreScroll: false });
  }, [status, categoryName, categoryChannels]);

  // Al entrar en una categoría se empieza arriba; al volver, el inicio recupera su posición.
  const shownCategory = categoryChannels ? categoryName : null;
  const previousCategory = useRef(shownCategory);
  useLayoutEffect(() => {
    if (previousCategory.current === shownCategory) return;
    const wasHome = previousCategory.current === null;
    previousCategory.current = shownCategory;
    if (shownCategory) window.scrollTo(0, 0);
    else if (!wasHome) window.scrollTo(0, consumeRestoreScroll() ? homeScroll.current : 0);
  }, [shownCategory]);

  const handleOpenCategory = (name: string) => {
    homeScroll.current = window.scrollY;
    openCategory(name);
  };

  const showContent = status === 'ready' || (status === 'loading' && channels.length > 0);

  let content;
  if (!showContent) {
    content = <StatusScreen />;
  } else if (searchResults) {
    content = (
      <ChannelGrid
        title={`Resultados para «${deferredQuery.trim()}»`}
        channels={searchResults}
        onPlay={playChannel}
        emptyMessage="Ningún canal coincide con tu búsqueda."
      />
    );
  } else if (searchOpen) {
    // Pantalla de búsqueda del móvil antes de escribir nada: todos los canales para explorar.
    content = (
      <ChannelGrid
        title="Todos los canales"
        channels={channels}
        onPlay={playChannel}
        emptyMessage="No hay canales cargados."
      />
    );
  } else if (shownCategory && categoryChannels) {
    content = (
      <CategoryView
        key={`${playlistVersion}-${shownCategory}`}
        name={shownCategory}
        channels={categoryChannels}
        onPlay={playChannel}
        highlights={shownCategory === FOOTBALL_CATEGORY ? footballMatches : undefined}
      />
    );
  } else {
    content = (
      <>
        {featured && <HeroBanner channel={featured} onPlay={(c) => playChannel(c, channels)} />}
        <div className="relative z-10 mt-5 space-y-1 pb-8 md:-mt-40 md:pb-16">
          {footballChannels.length > 0 && (
            <CategoryRow
              key={`${playlistVersion}-football`}
              title={FOOTBALL_CATEGORY}
              channels={footballChannels}
              highlights={footballMatches}
              onPlay={playChannel}
              onOpen={() => handleOpenCategory(FOOTBALL_CATEGORY)}
            />
          )}
          {recentChannels.length > 0 && (
            <CategoryRow
              key={`${playlistVersion}-recents`}
              title={RECENTS_CATEGORY}
              channels={recentChannels}
              onPlay={playChannel}
              onOpen={() => handleOpenCategory(RECENTS_CATEGORY)}
            />
          )}
          {favoriteChannels.length > 0 && (
            <CategoryRow
              key={`${playlistVersion}-favorites`}
              title={FAVORITES_CATEGORY}
              channels={favoriteChannels}
              onPlay={playChannel}
              onOpen={() => handleOpenCategory(FAVORITES_CATEGORY)}
            />
          )}
          {categories.map((category) => (
            <CategoryRow
              key={`${playlistVersion}-${category.name}`}
              title={category.name}
              channels={category.channels}
              onPlay={playChannel}
              onOpen={() => handleOpenCategory(category.name)}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <div
      className={`min-h-dvh overflow-x-hidden bg-neutral-950 pb-[var(--bottom-nav-h)] text-neutral-100 ${searchOpen ? 'search-open' : ''}`}
    >
      <Navbar />
      <main>{content}</main>
      {showContent && <BottomNav onOpenFavorites={() => handleOpenCategory(FAVORITES_CATEGORY)} />}

      <Sheets />
      {hasActiveChannel && <LazyPlayer />}
      <Toast />
    </div>
  );
}
