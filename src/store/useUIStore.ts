import { create } from 'zustand';
import type { Channel } from '../types';
import { useIPTVStore } from './useIPTVStore';

/** Panel inferior abierto (en escritorio, ventana centrada). Solo hay uno a la vez. */
export type Sheet =
  | { type: 'more' }
  | { type: 'filter' }
  | { type: 'load' }
  /** Acciones de un canal (pulsación larga en una tarjeta); `play` lo abre con su lista. */
  | { type: 'channel'; channel: Channel; play: () => void };

type UIState = {
  sheet: Sheet | null;
  /** Pantalla de búsqueda del móvil (pestaña "Buscar"). En escritorio se busca desde la barra superior. */
  searchOpen: boolean;
  /** El reproductor está en ventana flotante (imagen en imagen): la pantalla del reproductor se oculta. */
  pip: boolean;
  openSheet: (sheet: Sheet) => void;
  closeSheet: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  setPip: (pip: boolean) => void;
};

export const useUIStore = create<UIState>()((set) => ({
  sheet: null,
  searchOpen: false,
  pip: false,
  setPip: (pip) => set({ pip }),
  openSheet: (sheet) => set({ sheet }),
  closeSheet: () => set({ sheet: null }),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => {
    useIPTVStore.getState().setSearchQuery('');
    set({ searchOpen: false });
  },
}));
