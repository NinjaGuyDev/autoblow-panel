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
  const [savedToken, setSavedToken] = useState<string>('');
  const ultraRef = useRef<Ultra | null>(null);

  // Load saved token from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (token) {
      setSavedToken(token);
    }
  }, []);

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
        localStorage.setItem(DEVICE_TOKEN_KEY, token);
        setSavedToken(token);
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

    // Clear saved token from localStorage on disconnect
    localStorage.removeItem(DEVICE_TOKEN_KEY);
    setSavedToken('');
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
