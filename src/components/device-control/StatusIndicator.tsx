import type { ConnectionState } from '@/types/device';

interface StatusIndicatorProps {
  state: ConnectionState;
  error: string | null;
}

/**
 * Presentation component for connection status
 * Uses text AND color for accessibility (not color alone)
 */
export function StatusIndicator({ state, error }: StatusIndicatorProps) {
  const stateConfig: Record<ConnectionState, { color: string; dotColor: string; label: string }> = {
    disconnected: {
      color: 'text-muted-foreground',
      dotColor: 'bg-muted',
      label: 'Disconnected',
    },
    connecting: {
      color: 'text-yellow-500',
      dotColor: 'bg-yellow-500',
      label: 'Connecting...',
    },
    connected: {
      color: 'text-green-500',
      dotColor: 'bg-green-500',
      label: 'Connected',
    },
    error: {
      color: 'text-red-500',
      dotColor: 'bg-red-500',
      label: 'Error',
    },
  };

  const config = stateConfig[state];

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full w-2.5 h-2.5 inline-block ${config.dotColor}`} />
        <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
      </div>
      {error && (
        <p className="text-sm text-red-400 mt-1">{error}</p>
      )}
    </div>
  );
}
