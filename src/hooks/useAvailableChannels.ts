import { useShallow } from 'zustand/react/shallow';
import { useIPTVStore } from '../store/useIPTVStore';
import { useStreamStatus } from '../store/useStreamStatus';
import type { Channel } from '../types';

type Statuses = ReturnType<typeof useStreamStatus.getState>['statuses'];

const isOffline = (statuses: Statuses, channel: Channel) => statuses[channel.id]?.status === 'offline';

/**
 * `channels` sin los que se sabe que no están disponibles, si el usuario ha activado
 * "Ocultar no disponibles". Los que aún no se han comprobado se muestran.
 * Con `useShallow` el componente solo se vuelve a pintar cuando cambia su propia lista,
 * no con cada resultado de comprobación de cualquier canal.
 */
export function useAvailableChannels(channels: Channel[]): Channel[] {
  const hide = useIPTVStore((s) => s.hideUnavailable);
  return useStreamStatus(
    useShallow((s) => (hide ? channels.filter((c) => !isOffline(s.statuses, c)) : channels)),
  );
}

/** Cuántos de `channels` están marcados como no disponibles. */
export function useOfflineCount(channels: Channel[]): number {
  return useStreamStatus((s) => channels.reduce((n, c) => n + (isOffline(s.statuses, c) ? 1 : 0), 0));
}
