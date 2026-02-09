import { useState, useEffect, useRef } from 'react';
import { useDevice } from '@/contexts/DeviceContext';

interface AppHeaderProps {
  onNewScript: () => void;
  isCreationMode: boolean;
}

/**
 * App header with amber gradient logo, device connection controls, and status indicator.
 * Shows token input + connect button when disconnected.
 * Shows animated connected indicator when connected.
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

  const connected = connectionState === 'connected';

  return (
    <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
      {/* Left: Logo + title */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
          style={{
            background: 'linear-gradient(135deg, #c8956c 0%, #a07050 100%)',
            fontFamily: 'var(--font-display)',
          }}
        >
          A
        </div>
        <span
          className="text-lg font-semibold text-stone-100 tracking-tight hidden sm:inline"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Autoblow Panel
        </span>
      </div>

      {/* Right: Connection controls */}
      <div className="flex items-center gap-3">
        {/* Connected indicator badge */}
        {connected && (
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/30">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span
              className="text-[11px] font-semibold text-emerald-400 tracking-wide"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              CONNECTED
            </span>
          </div>
        )}

        {/* Token input */}
        {(connectionState === 'disconnected' || connectionState === 'error') && (
          <input
            type="text"
            value={tokenValue}
            onChange={(e) => setTokenValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Device Token"
            className="w-36 sm:w-48 rounded-lg border border-stone-800 bg-stone-900/60 px-3 py-2.5 text-sm text-stone-200 placeholder:text-stone-600 outline-none focus:ring-1 focus:ring-amber-700/40 focus:border-amber-800/60 transition-colors"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
        )}

        {/* Connecting state */}
        {connectionState === 'connecting' && (
          <span className="text-sm text-stone-500">Connecting...</span>
        )}

        {/* Plug icon button */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={handlePlugClick}
            disabled={connectionState === 'connecting' || (connectionState !== 'connected' && !tokenValue.trim())}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              connected
                ? 'bg-emerald-950/30 border border-emerald-700/60 text-emerald-400 hover:bg-emerald-950/50'
                : connectionState === 'error'
                ? 'bg-orange-900/30 border border-orange-700/60 text-orange-400 hover:bg-orange-900/50'
                : connectionState === 'connecting'
                ? 'bg-stone-800 border border-stone-700 text-stone-500 cursor-not-allowed animate-pulse'
                : 'bg-transparent border border-stone-800 text-stone-400 hover:bg-stone-800 hover:text-stone-200'
            }`}
            aria-label={
              connected
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
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="inline-block shrink-0">
              <path d="M12 22v-5" />
              <path d="M9 8V2" />
              <path d="M15 8V2" />
              <path d="M18 8v5a6 6 0 0 1-12 0V8z" />
            </svg>
          </button>

          {/* Popover for connected state */}
          {showPopover && connected && deviceInfo && (
            <div className="absolute right-0 top-12 rounded-xl border border-stone-800 bg-stone-900/95 shadow-xl p-4 min-w-[220px] z-50 backdrop-blur-sm">
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-stone-500">Device Type</p>
                  <p className="text-sm font-medium text-stone-200">{formatDeviceType(deviceInfo.deviceType)}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Firmware</p>
                  <p className="text-sm text-stone-300">{deviceInfo.firmwareVersion}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Hardware</p>
                  <p className="text-sm text-stone-300">{deviceInfo.hardwareVersion}</p>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                className="w-full mt-4 px-3 py-2 bg-stone-800 text-stone-300 rounded-lg hover:bg-stone-700 text-sm transition-colors"
              >
                Disconnect
              </button>
            </div>
          )}

          {/* Error popover */}
          {showPopover && connectionState === 'error' && error && (
            <div className="absolute right-0 top-12 rounded-xl border border-orange-800/50 bg-stone-900/95 shadow-xl p-4 min-w-[220px] z-50 backdrop-blur-sm">
              <p className="text-sm text-orange-400">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
