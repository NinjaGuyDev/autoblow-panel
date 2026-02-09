import type { SyncStatus as SyncStatusType } from '@/types/sync';

interface SyncStatusProps {
  syncStatus: SyncStatusType;
  scriptUploaded: boolean;
  driftMs: number;
  error: string | null;
  isDeviceConnected: boolean;
  hasFunscript: boolean;
}

/**
 * Presentation component for sync playback status
 * Follows existing pattern (stateless, props-driven like StatusIndicator, ManualControls)
 */
export function SyncStatus({
  syncStatus,
  driftMs,
  error,
  isDeviceConnected,
  hasFunscript,
}: SyncStatusProps) {
  // Define status configurations
  // Keep green/yellow/red for STATUS indicators (connected dot, sync status dots)
  const statusConfig: Record<
    SyncStatusType,
    { color: string; dotColor: string; label: string; showDrift?: boolean; pulsing?: boolean }
  > = {
    idle: {
      color: 'text-stone-500',
      dotColor: 'bg-stone-800/50',
      label: 'Sync idle',
    },
    uploading: {
      color: 'text-yellow-500',
      dotColor: 'bg-yellow-500',
      label: 'Uploading script to device...',
    },
    ready: {
      color: 'text-green-500',
      dotColor: 'bg-green-500',
      label: 'Ready — play video to sync',
    },
    playing: {
      color: 'text-green-500',
      dotColor: 'bg-green-500',
      label: 'Syncing',
      showDrift: true,
      pulsing: true,
    },
    paused: {
      color: 'text-stone-500',
      dotColor: 'bg-stone-800/50',
      label: 'Sync paused',
    },
    error: {
      color: 'text-red-500',
      dotColor: 'bg-red-500',
      label: 'Sync error',
    },
  };

  // Show prerequisite message if device not connected or no funscript
  if (!isDeviceConnected || !hasFunscript) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Sync Playback</h3>
        <p className="text-sm text-stone-500">
          Load funscript and connect device to enable sync
        </p>
      </div>
    );
  }

  const config = statusConfig[syncStatus];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Sync Playback</h3>

      <div className="flex items-center gap-2">
        <span
          className={`rounded-full w-2.5 h-2.5 inline-block ${config.dotColor} ${
            config.pulsing ? 'animate-pulse' : ''
          }`}
        />
        <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
      </div>

      {/* Show drift when playing */}
      {config.showDrift && (
        <div className="text-sm text-stone-500">
          <span className="font-medium">Drift:</span>{' '}
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {driftMs >= 0 ? '+' : ''}
            {Math.round(driftMs)}ms
          </span>
        </div>
      )}

      {/* Show error if present */}
      {syncStatus === 'error' && error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
