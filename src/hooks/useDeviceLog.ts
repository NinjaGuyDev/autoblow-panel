import { useState, useCallback } from 'react';

/**
 * Phase 6 logs state-change events (connected, disconnected, sync status, errors).
 * 'sent'/'received' types are reserved for future SDK command logging — not yet wired to actual device traffic.
 */
export interface DeviceLogEntry {
  timestamp: Date;
  type: 'sent' | 'received' | 'info' | 'error';
  message: string;
}

export function useDeviceLog() {
  const [logs, setLogs] = useState<DeviceLogEntry[]>([]);

  const addLog = useCallback((type: DeviceLogEntry['type'], message: string) => {
    const entry: DeviceLogEntry = {
      timestamp: new Date(),
      type,
      message,
    };

    setLogs((prev) => {
      // Prepend new entry (newest first) and cap at 500 entries
      const updated = [entry, ...prev];
      return updated.slice(0, 500);
    });
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return { logs, addLog, clearLogs };
}
