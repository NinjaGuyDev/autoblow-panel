import { useDevice } from '@/contexts/DeviceContext';
import type { DeviceLogEntry } from '@/hooks/useDeviceLog';

/**
 * Device Log page - displays device communication log with timestamps
 */
export function DeviceLogPage() {
  const { logs, clearLogs } = useDevice();
  const formatTimestamp = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  };

  const getTypeBadge = (type: DeviceLogEntry['type']) => {
    const configs = {
      sent: {
        bg: 'bg-blue-500/20',
        text: 'text-blue-400',
        label: 'SENT',
      },
      received: {
        bg: 'bg-green-500/20',
        text: 'text-green-400',
        label: 'RECV',
      },
      info: {
        bg: 'bg-muted',
        text: 'text-muted-foreground',
        label: 'INFO',
      },
      error: {
        bg: 'bg-red-500/20',
        text: 'text-red-400',
        label: 'ERROR',
      },
    };

    const config = configs[type];
    return (
      <span
        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}
      >
        {config.label}
      </span>
    );
  };

  return (
    <div role="tabpanel" id="panel-device-log" aria-labelledby="tab-device-log">
      <div className="max-w-6xl mx-auto">
        <div className="bg-card border border-muted rounded-lg p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Device Communication Log</h2>
            {logs.length > 0 && (
              <button
                onClick={clearLogs}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Log display */}
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No device communication logs yet. Connect a device and interact with it to see logs.
            </p>
          ) : (
            <div className="font-mono text-sm space-y-1 max-h-[600px] overflow-y-auto">
              {logs.map((entry, index) => (
                <div key={index} className="flex gap-2">
                  <span className="text-primary shrink-0">
                    [{formatTimestamp(entry.timestamp)}]
                  </span>
                  {getTypeBadge(entry.type)}
                  <span className="text-foreground">{entry.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
