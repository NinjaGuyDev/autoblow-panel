import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useDeviceConnection } from '@/hooks/useDeviceConnection';
import { useDeviceLog } from '@/hooks/useDeviceLog';
import type { DeviceLogEntry } from '@/hooks/useDeviceLog';
import type { ConnectionState, DeviceInfo } from '@/types/device';
import type { Ultra } from '@xsense/autoblow-sdk';

interface DeviceContextValue {
  connectionState: ConnectionState;
  deviceError: string | null;
  deviceInfo: DeviceInfo | null;
  connect: (token: string) => Promise<void>;
  disconnect: () => void;
  ultra: Ultra | null;
  savedToken: string;
  isDeviceConnected: boolean;
  logs: DeviceLogEntry[];
  addLog: (type: DeviceLogEntry['type'], message: string) => void;
  clearLogs: () => void;
}

const DeviceContext = createContext<DeviceContextValue | null>(null);

/**
 * Provides device connection state, device logging, and connection-related
 * log side-effects to the component tree. Consumers use useDevice() to access.
 */
export function DeviceProvider({ children }: { children: ReactNode }) {
  const {
    connectionState,
    error: deviceError,
    deviceInfo,
    connect,
    disconnect,
    ultra,
    savedToken,
  } = useDeviceConnection();

  const { logs, addLog, clearLogs } = useDeviceLog();
  const isDeviceConnected = connectionState === 'connected';

  // Track connection state changes in device log
  const prevConnectionStateRef = useRef<ConnectionState>('disconnected');
  useEffect(() => {
    if (connectionState === 'connected' && prevConnectionStateRef.current !== 'connected') {
      addLog('info', 'Device connected');
    } else if (connectionState === 'disconnected' && prevConnectionStateRef.current === 'connected') {
      addLog('info', 'Device disconnected');
    }
    prevConnectionStateRef.current = connectionState;
  }, [connectionState, addLog]);

  // Track device errors in device log
  useEffect(() => {
    if (deviceError) {
      addLog('error', deviceError);
    }
  }, [deviceError, addLog]);

  return (
    <DeviceContext.Provider
      value={{
        connectionState,
        deviceError,
        deviceInfo,
        connect,
        disconnect,
        ultra,
        savedToken,
        isDeviceConnected,
        logs,
        addLog,
        clearLogs,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice(): DeviceContextValue {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
}
