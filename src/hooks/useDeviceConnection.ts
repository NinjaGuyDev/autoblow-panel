import { useState, useEffect, useRef } from 'react';
import { deviceInit, DeviceNotConnectedError, DeviceTimeoutError } from '@xsense/autoblow-sdk';
import type { Ultra } from '@xsense/autoblow-sdk';
import type {
  ConnectionState,
  DeviceInfo,
  UseDeviceConnectionReturn,
} from '@/types/device';

const DEVICE_TOKEN_KEY = 'autoblow-device-token';

/**
 * Hook to manage device connection state and lifecycle
 * Follows the same pattern as useVideoPlayback - encapsulates state with clean return interface
 */
export function useDeviceConnection(): UseDeviceConnectionReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);

  // Initialize savedToken directly from localStorage (lazy initialization)
  const [savedToken, setSavedToken] = useState<string>(() => {
    console.log('Loading token from localStorage on mount...');
    const token = localStorage.getItem(DEVICE_TOKEN_KEY);
    console.log('Found token:', token);
    return token || '';
  });

  const ultraRef = useRef<Ultra | null>(null);

  const connect = async (token: string) => {
    // Clear previous errors on new connection attempt
    setError(null);
    setConnectionState('connecting');

    try {
      // Use deviceInit which returns { ultra, deviceInfo } or { vacuglide, deviceInfo }
      const result = await deviceInit(token);

      // We're targeting Autoblow AI Ultra, so check for ultra device
      if (result.deviceType === 'autoblow-ultra' && result.ultra) {
        setDeviceInfo(result.deviceInfo);
        ultraRef.current = result.ultra;
        setConnectionState('connected');

        // Save token to localStorage on successful connection
        console.log('Saving token to localStorage:', DEVICE_TOKEN_KEY, token);
        localStorage.setItem(DEVICE_TOKEN_KEY, token);
        setSavedToken(token);
        console.log('Token saved. Verification:', localStorage.getItem(DEVICE_TOKEN_KEY));
      } else {
        throw new Error('Device is not an Autoblow AI Ultra');
      }
    } catch (err) {
      // Extract meaningful error messages from SDK error types
      let message = 'Unknown connection error';

      if (err instanceof DeviceNotConnectedError) {
        message = 'Device not found or offline';
      } else if (err instanceof DeviceTimeoutError) {
        message = 'Connection timed out';
      } else if (err instanceof Error) {
        message = err.message;
      }

      setError(message);
      setConnectionState('error');
      ultraRef.current = null;
    }
  };

  const disconnect = () => {
    // Reset all state (SDK doesn't expose explicit disconnect method)
    ultraRef.current = null;
    setConnectionState('disconnected');
    setDeviceInfo(null);
    setError(null);

    // Keep token in localStorage for convenience (don't clear on disconnect)
    // Token persists across page reloads so user doesn't need to re-enter
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    connectionState,
    error,
    deviceInfo,
    connect,
    disconnect,
    ultra: ultraRef.current,
    savedToken,
  };
}
