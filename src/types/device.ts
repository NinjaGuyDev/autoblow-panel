import type { Ultra, DeviceInfo as SDKDeviceInfo } from '@xsense/autoblow-sdk';

// Connection state type
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Re-export SDK DeviceInfo for external use
export type DeviceInfo = SDKDeviceInfo;

// Pattern types for manual control
export type PatternType = 'oscillation' | 'sine-wave' | 'triangle-wave' | 'random-walk';

// SDK oscillation parameters (built-in oscillation)
export interface OscillationParams {
  speed: number;  // 0-100
  minY: number;   // 0-100, min stroke position
  maxY: number;   // 0-100, max stroke position
}

// Full manual control parameters (including custom patterns)
export interface ManualControlParams {
  patternType: PatternType;
  speed: number;        // 0-100, controls frequency/tempo of motion
  minY: number;         // 0-100, minimum stroke position
  maxY: number;         // 0-100, maximum stroke position
  increment: number;    // 1-50, step size per animation tick
  variability: number;  // 0-100, randomness added to pattern
}

// Return type for useDeviceConnection hook
export interface UseDeviceConnectionReturn {
  connectionState: ConnectionState;
  error: string | null;
  deviceInfo: DeviceInfo | null;
  connect: (token: string) => Promise<void>;
  disconnect: () => void;
  ultra: Ultra | null;  // Expose SDK Ultra instance for manual control hook
}
