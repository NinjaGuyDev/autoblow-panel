import { useState, useRef, useEffect } from 'react';
import type { ConnectionState, DeviceInfo } from '@/types/device';
import { cn } from '@/lib/utils';

interface ConnectionStatusButtonProps {
  state: ConnectionState;
  deviceInfo: DeviceInfo | null;
  error: string | null;
  onDisconnect: () => void;
}

/**
 * Connection status icon button with popover for device info.
 * Shows green/red/gray circle based on connection state.
 * Clicking while connected opens popover with device details and disconnect button.
 */
export function ConnectionStatusButton({
  state,
  deviceInfo,
  error,
  onDisconnect,
}: ConnectionStatusButtonProps) {
  const [showPopover, setShowPopover] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setShowPopover(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopover]);

  const handleClick = () => {
    setShowPopover((prev) => !prev);
  };

  const handleDisconnect = () => {
    setShowPopover(false);
    onDisconnect();
  };

  // Determine button colors
  const buttonColors =
    state === 'connected'
      ? 'bg-green-500'
      : state === 'error'
      ? 'bg-red-500'
      : 'bg-gray-500';

  // Determine aria-label
  const ariaLabel =
    state === 'connected' && deviceInfo
      ? `Connected to ${deviceInfo.deviceType === 'autoblow-ultra' ? 'Autoblow AI Ultra' : deviceInfo.deviceType}`
      : state === 'error'
      ? 'Connection error'
      : 'Disconnected';

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleClick}
        aria-label={ariaLabel}
        aria-expanded={showPopover}
        aria-haspopup="true"
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          buttonColors,
          state === 'connecting' && 'animate-pulse'
        )}
      >
        <div
          className={cn(
            'w-3 h-3 rounded-full bg-white',
            state === 'connected' ? 'opacity-100' : 'opacity-50'
          )}
        />
      </button>

      {/* Popover */}
      {showPopover && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-12 bg-card border border-muted rounded-lg shadow-xl p-4 min-w-[220px] z-50"
        >
          {/* Connected state - show device info */}
          {state === 'connected' && deviceInfo && (
            <div className="space-y-3">
              <div className="text-sm space-y-1 text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Device:</span>{' '}
                  {deviceInfo.deviceType === 'autoblow-ultra'
                    ? 'Autoblow AI Ultra'
                    : deviceInfo.deviceType}
                </p>
                <p>
                  <span className="font-medium text-foreground">Firmware:</span>{' '}
                  v{deviceInfo.firmwareVersion}
                </p>
                <p>
                  <span className="font-medium text-foreground">Hardware:</span>{' '}
                  {deviceInfo.hardwareVersion}
                </p>
              </div>
              <button
                onClick={handleDisconnect}
                className="bg-secondary text-secondary-foreground px-3 py-2 rounded text-sm hover:opacity-90 w-full"
              >
                Disconnect
              </button>
            </div>
          )}

          {/* Error state - show error message */}
          {(state === 'disconnected' || state === 'error') && error && (
            <div className="text-sm text-red-500">{error}</div>
          )}
        </div>
      )}
    </div>
  );
}
