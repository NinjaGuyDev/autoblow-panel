import { useState } from 'react';
import type { ConnectionState, DeviceInfo } from '@/types/device';
import { StatusIndicator } from './StatusIndicator';

interface DeviceConnectionProps {
  connectionState: ConnectionState;
  error: string | null;
  deviceInfo: DeviceInfo | null;
  onConnect: (token: string) => void;
  onDisconnect: () => void;
}

/**
 * Presentation component for device connection controls
 * No hooks - all state lifted to parent
 */
export function DeviceConnection({
  connectionState,
  error,
  deviceInfo,
  onConnect,
  onDisconnect,
}: DeviceConnectionProps) {
  const [tokenValue, setTokenValue] = useState('');

  const handleConnectClick = () => {
    if (tokenValue.trim()) {
      onConnect(tokenValue.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tokenValue.trim()) {
      onConnect(tokenValue.trim());
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Device Connection</h2>
        <StatusIndicator state={connectionState} error={error} />
      </div>

      {/* Connection controls - shown when disconnected or error */}
      {(connectionState === 'disconnected' || connectionState === 'error') && (
        <div className="space-y-3">
          <input
            type="text"
            value={tokenValue}
            onChange={(e) => setTokenValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter device token"
            className="bg-background border border-muted rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={handleConnectClick}
            disabled={!tokenValue.trim()}
            className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed w-full"
          >
            Connect
          </button>
        </div>
      )}

      {/* Connecting state */}
      {connectionState === 'connecting' && (
        <div className="text-sm text-muted-foreground text-center py-4">
          Connecting to device...
        </div>
      )}

      {/* Connected state - show device info and disconnect button */}
      {connectionState === 'connected' && deviceInfo && (
        <div className="space-y-3">
          <div className="text-sm space-y-1 text-muted-foreground">
            <p>
              <span className="font-medium">Device:</span> {deviceInfo.deviceType === 'autoblow-ultra' ? 'Autoblow AI Ultra' : deviceInfo.deviceType}
            </p>
            <p>
              <span className="font-medium">Firmware:</span> v{deviceInfo.firmwareVersion}
            </p>
            <p>
              <span className="font-medium">Hardware:</span> {deviceInfo.hardwareVersion}
            </p>
          </div>
          <button
            onClick={onDisconnect}
            className="bg-secondary text-secondary-foreground px-4 py-2 rounded text-sm hover:opacity-90 w-full"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
