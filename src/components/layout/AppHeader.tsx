import { useState, useEffect, useRef } from 'react';
import { useDevice } from '@/contexts/DeviceContext';

interface AppHeaderProps {
  onNewScript: () => void;
  isCreationMode: boolean;
}

/**
 * App header with title, device connection controls, and status indicator.
 * Shows token input + connect button when disconnected.
 * Shows connection status icon button in all states.
 */
export function AppHeader({
  onNewScript,
  isCreationMode,
}: AppHeaderProps) {
  const { connectionState, deviceInfo, deviceError: error, savedToken, connect, disconnect } = useDevice();
  const [tokenValue, setTokenValue] = useState(savedToken || '');
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Update token input when savedToken changes
  useEffect(() => {
    if (savedToken) {
      setTokenValue(savedToken);
    }
  }, [savedToken]);

  // Close popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };

    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPopover]);

  const handleConnectClick = () => {
    if (tokenValue.trim()) {
      connect(tokenValue.trim());
    }
  };

  const handlePlugClick = () => {
    if (connectionState === 'connected') {
      setShowPopover(!showPopover);
    } else if (connectionState === 'disconnected' || connectionState === 'error') {
      handleConnectClick();
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setShowPopover(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tokenValue.trim()) {
      connect(tokenValue.trim());
    }
  };

  // Format device type for display
  const formatDeviceType = (type: string | undefined) => {
    if (!type) return 'Unknown Device';
    return type
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="flex items-center px-4 py-3">
      {/* Left: App title */}
      <h1 className="text-xl font-bold flex-shrink-0">Autoblow Panel</h1>

      {/* Center: New Script button */}
      <div className="flex-1 flex justify-center">
        <button
          onClick={onNewScript}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            isCreationMode
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isCreationMode ? '✓ Creating Script' : '+ New Script'}
        </button>
      </div>

      {/* Right: Connection controls */}
      <div className="flex items-center gap-3 relative">
        {/* Token input - shown when disconnected or error */}
        {(connectionState === 'disconnected' || connectionState === 'error') && (
          <input
            type="text"
            value={tokenValue}
            onChange={(e) => setTokenValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Device Token"
            className="bg-background border border-muted rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}

        {/* Connecting state */}
        {connectionState === 'connecting' && (
          <span className="text-sm text-muted-foreground">Connecting...</span>
        )}

        {/* Plug icon button */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={handlePlugClick}
            disabled={connectionState === 'connecting' || (connectionState !== 'connected' && !tokenValue.trim())}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background ${
              connectionState === 'connected'
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : connectionState === 'error'
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : connectionState === 'connecting'
                ? 'bg-gray-500 text-white cursor-not-allowed'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
            aria-label={
              connectionState === 'connected'
                ? `Connected to ${formatDeviceType(deviceInfo?.deviceType)}`
                : connectionState === 'connecting'
                ? 'Connecting...'
                : connectionState === 'error'
                ? 'Connection error'
                : 'Connect to device'
            }
            aria-expanded={showPopover}
            aria-haspopup="true"
          >
            <span className="text-xl" aria-hidden="true">🔌</span>
          </button>

          {/* Popover for connected state */}
          {showPopover && connectionState === 'connected' && deviceInfo && (
            <div className="absolute right-0 top-12 bg-card border border-muted rounded-lg shadow-xl p-4 min-w-[220px] z-50">
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Device Type</p>
                  <p className="text-sm font-medium">{formatDeviceType(deviceInfo.deviceType)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Firmware</p>
                  <p className="text-sm">{deviceInfo.firmwareVersion}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Hardware</p>
                  <p className="text-sm">{deviceInfo.hardwareVersion}</p>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                className="w-full mt-4 px-3 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 text-sm transition-colors"
              >
                Disconnect
              </button>
            </div>
          )}

          {/* Error popover */}
          {showPopover && connectionState === 'error' && error && (
            <div className="absolute right-0 top-12 bg-card border border-destructive rounded-lg shadow-xl p-4 min-w-[220px] z-50">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
