import { useState, useEffect } from 'react';
import type { ConnectionState, DeviceInfo } from '@/types/device';
import { ConnectionStatusButton } from './ConnectionStatusButton';

interface AppHeaderProps {
  connectionState: ConnectionState;
  deviceInfo: DeviceInfo | null;
  error: string | null;
  savedToken: string;
  onConnect: (token: string) => void;
  onDisconnect: () => void;
}

/**
 * App header with title, device connection controls, and status indicator.
 * Shows token input + connect button when disconnected.
 * Shows connection status icon button in all states.
 */
export function AppHeader({
  connectionState,
  deviceInfo,
  error,
  savedToken,
  onConnect,
  onDisconnect,
}: AppHeaderProps) {
  const [tokenValue, setTokenValue] = useState(savedToken || '');

  // Update token input when savedToken changes
  useEffect(() => {
    if (savedToken) {
      setTokenValue(savedToken);
    }
  }, [savedToken]);

  const handleConnectClick = () => {
    if (tokenValue.trim()) {
      onConnect(tokenValue.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tokenValue.trim()) {
      onConnect(tokenValue.trim());
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-3">
      {/* Left: App title */}
      <h1 className="text-xl font-bold">Autoblow Panel</h1>

      {/* Right: Connection controls */}
      <div className="flex items-center gap-3">
        {/* Token input and connect button - shown when disconnected or error */}
        {(connectionState === 'disconnected' || connectionState === 'error') && (
          <>
            <input
              type="text"
              value={tokenValue}
              onChange={(e) => setTokenValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Device Token"
              className="bg-background border border-muted rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={handleConnectClick}
              disabled={!tokenValue.trim()}
              className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Connect
            </button>
          </>
        )}

        {/* Connecting state */}
        {connectionState === 'connecting' && (
          <span className="text-sm text-muted-foreground">Connecting...</span>
        )}

        {/* Connection status button - always shown */}
        <ConnectionStatusButton
          state={connectionState}
          deviceInfo={deviceInfo}
          error={error}
          onDisconnect={onDisconnect}
        />
      </div>
    </div>
  );
}
