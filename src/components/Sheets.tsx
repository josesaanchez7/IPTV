import { Check, ChevronRight, Download, ExternalLink, EyeOff, ListFilter, ListPlus, Play, Plus, RefreshCw, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { SPANISH_SOURCES } from '../config';
import { useOfflineCount } from '../hooks/useAvailableChannels';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { officialLive } from '../lib/officialLive';
import { useIPTVStore } from '../store/useIPTVStore';
import { useStreamStatus } from '../store/useStreamStatus';
import { useUIStore, type Sheet } from '../store/useUIStore';
import type { Channel } from '../types';
import BottomSheet, { SheetHeader } from './BottomSheet';
import CategoryFilterSheet from './CategoryFilterSheet';
import { QualityBadge, StatusBadges } from './ChannelBadges';
import { NowNextText } from './Guide';
import ChannelLogo from './ChannelLogo';
import LoadPlaylistSheet from './LoadPlaylistSheet';

const SHEET_LABELS: Record<Sheet['type'], string> = {
  more: 'Más opciones',
  filter: 'Categorías',
  load: 'Cargar lista M3U',
  channel: 'Acciones del canal',
};

/** El panel inferior abierto (`useUIStore().sheet`), si hay alguno. */
export default function Sheets() {
  const sheet = useUIStore((s) => s.sheet);
  const closeSheet = useUIStore((s) => s.closeSheet);

  let content: ReactNode = null;
  if (sheet?.type === 'more') content = <MoreSheet onClose={closeSheet} />;
  else if (sheet?.type === 'filter') content = <CategoryFilterSheet onClose={closeSheet} />;
  else if (sheet?.type === 'load') content = <LoadPlaylistSheet onClose={closeSheet} />;
  else if (sheet?.type === 'channel') content = <ChannelSheet channel={sheet.channel} play={sheet.play} onClose={closeSheet} />;

  return (
    <BottomSheet open={sheet !== null} onClose={closeSheet} label={sheet ? SHEET_LABELS[sheet.type] : ''}>
      {content}
    </BottomSheet>
  );
}

/** Opciones que en escritorio están en la barra superior. */
function MoreSheet({ onClose }: { onClose: () => void }) {
  const channels = useIPTVStore((s) => s.channels);
  const hideUnavailable = useIPTVStore((s) => s.hideUnavailable);
  const toggleHideUnavailable = useIPTVStore((s) => s.toggleHideUnavailable);
  const hiddenCount = useIPTVStore((s) => s.hidden.categories.length + s.hidden.regions.length);
  const isSpanish = useIPTVStore((s) => s.playlistSource?.type === 'spanish');
  const openSheet = useUIStore((s) => s.openSheet);
  const offlineCount = useOfflineCount(channels);
  const { canInstall, needsManualInstall, install } = useInstallPrompt();

  return (
    <>
      <SheetHeader title="Más" onClose={onClose} />
      <ul className="overflow-y-auto px-2 pb-4">
        {(canInstall || needsManualInstall) && (
          <li>
            <MenuRow
              icon={<Download className="h-5 w-5" />}
              label="Instalar aplicación"
              detail={
                canInstall
                  ? 'Se abre a pantalla completa, como una app'
                  : 'Toca Compartir y «Añadir a pantalla de inicio»'
              }
              onClick={() => {
                if (canInstall) {
                  onClose();
                  void install();
                }
              }}
            />
          </li>
        )}
        <li>
          <MenuRow
            icon={<EyeOff className="h-5 w-5" />}
            label="Ocultar no disponibles"
            detail={`${offlineCount} detectados`}
            onClick={toggleHideUnavailable}
            pressed={hideUnavailable}
            trailing={<Switch on={hideUnavailable} />}
          />
        </li>
        <li>
          <MenuRow
            icon={<ListFilter className="h-5 w-5" />}
            label="Categorías y comunidades"
            detail={hiddenCount ? `${hiddenCount} ocultas` : 'Todo visible'}
            onClick={() => openSheet({ type: 'filter' })}
            trailing={<ChevronRight className="h-5 w-5 text-neutral-500" />}
          />
        </li>
        <li>
          <MenuRow
            icon={<ListPlus className="h-5 w-5" />}
            label="Cargar lista M3U"
            detail="Desde una URL o un archivo"
            onClick={() => openSheet({ type: 'load' })}
            trailing={<ChevronRight className="h-5 w-5 text-neutral-500" />}
          />
        </li>
        <li>
          <MenuRow
            icon={<RefreshCw className="h-5 w-5" />}
            label={isSpanish ? 'Recargar canales' : 'Volver a los canales españoles'}
            detail={SPANISH_SOURCES.map((s) => s.label).join(', ')}
            onClick={() => {
              onClose();
              void useIPTVStore.getState().loadSpanishSources();
            }}
          />
        </li>
      </ul>
    </>
  );
}

type MenuRowProps = {
  icon: ReactNode;
  label: string;
  detail?: string;
  onClick: () => void;
  pressed?: boolean;
  trailing?: ReactNode;
};

function MenuRow({ icon, label, detail, onClick, pressed, trailing }: MenuRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className="flex w-full items-center gap-4 rounded-lg px-3 py-3 text-left transition hover:bg-white/5 active:bg-white/10"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-neutral-200">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {detail && <span className="block truncate text-sm text-neutral-400">{detail}</span>}
      </span>
      {trailing}
    </button>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-brand' : 'bg-neutral-600'}`}
    >
      <span
        className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`}
      />
    </span>
  );
}

/** Acciones de un canal tras una pulsación larga en su tarjeta. */
type ChannelSheetProps = {
  channel: Channel;
  play: () => void;
  onClose: () => void;
};

function ChannelSheet({ channel, play, onClose }: ChannelSheetProps) {
  const isFavorite = useIPTVStore((s) => s.favorites.includes(channel.id));
  const toggleFavorite = useIPTVStore((s) => s.toggleFavorite);
  const offline = useStreamStatus((s) => s.statuses[channel.id]?.status === 'offline');
  const official = officialLive(channel);

  return (
    <div className="px-5 pt-2 pb-6 md:p-6">
      <div className="flex items-center gap-4">
        <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-neutral-700/60 to-neutral-900 ring-1 ring-white/10">
          <ChannelLogo channel={channel} className="absolute inset-0 p-3" textClassName="text-xl" />
        </div>
        <div className="min-w-0">
          <h2 className="line-clamp-2 text-lg leading-tight font-bold">{channel.name}</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-neutral-400">
            <span className="truncate">{[...channel.groups, channel.region].filter(Boolean).join(' · ')}</span>
            <QualityBadge quality={channel.badges.quality} />
          </p>
          <div className="mt-1.5">
            <StatusBadges badges={channel.badges} />
          </div>
          <div className="mt-1.5 [&>p]:line-clamp-2 [&>p]:whitespace-normal">
            <NowNextText channel={channel} />
          </div>
          {offline && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-neutral-400">
              <WifiOff className="h-3.5 w-3.5" />
              No disponible ahora
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            onClose();
            play();
          }}
          className="flex items-center justify-center gap-2 rounded-md bg-white py-3 font-bold text-black active:bg-white/80"
        >
          <Play className="h-5 w-5 fill-current" />
          Ver ahora
        </button>
        <button
          type="button"
          onClick={() => toggleFavorite(channel.id)}
          aria-pressed={isFavorite}
          className="flex items-center justify-center gap-2 rounded-md bg-neutral-700 py-3 font-bold text-white active:bg-neutral-600"
        >
          {isFavorite ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          Mi lista
        </button>
      </div>

      {official && (
        <a
          href={official.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-2 rounded-md border border-white/20 py-3 font-semibold text-white hover:bg-white/10 active:bg-white/15"
        >
          Ver en {official.service}
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}
