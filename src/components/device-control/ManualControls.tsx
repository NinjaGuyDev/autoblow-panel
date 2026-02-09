import type { PatternType, ManualControlParams } from '@/types/device';

interface ManualControlsProps {
  isRunning: boolean;
  patternType: PatternType;
  speed: number;
  minY: number;
  maxY: number;
  increment: number;
  variability: number;
  isConnected: boolean;
  onStart: () => void;
  onStop: () => void;
  onParamChange: (params: Partial<ManualControlParams>) => void;
  onPatternTypeChange: (type: PatternType) => void;
}

/**
 * Presentation component for manual device control
 * No hooks - all state lifted to parent
 */
export function ManualControls({
  isRunning,
  patternType,
  speed,
  minY,
  maxY,
  increment,
  variability,
  isConnected,
  onStart,
  onStop,
  onParamChange,
  onPatternTypeChange,
}: ManualControlsProps) {
  const patternTypes: Array<{ type: PatternType; label: string }> = [
    { type: 'oscillation', label: 'Oscillation' },
    { type: 'sine-wave', label: 'Sine Wave' },
    { type: 'triangle-wave', label: 'Triangle Wave' },
    { type: 'random-walk', label: 'Random Walk' },
  ];

  // Increment and variability are disabled for SDK oscillation mode
  const incrementDisabled = !isConnected || patternType === 'oscillation';
  const variabilityDisabled = !isConnected || patternType === 'oscillation';

  return (
    <div className="space-y-4">
      {/* Header */}
      <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Manual Control</h2>

      {/* Not connected message */}
      {!isConnected && (
        <p className="text-sm text-stone-500">
          Connect device to use manual controls
        </p>
      )}

      {/* Pattern Type Selector */}
      <div>
        <label className="text-sm font-medium mb-2 block">Pattern Type</label>
        <div className="flex gap-1">
          {patternTypes.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => onPatternTypeChange(type)}
              disabled={!isConnected}
              className={`
                flex-1 px-3 py-1.5 text-xs rounded border font-medium
                ${patternType === type
                  ? 'bg-amber-700 text-white border-amber-700 shadow-md ring-2 ring-amber-400/50'
                  : 'bg-stone-800 text-stone-400 border-stone-700 hover:text-stone-200 hover:border-stone-600'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all
              `}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Start/Stop Button */}
      <button
        onClick={isRunning ? onStop : onStart}
        disabled={!isConnected}
        className={`
          w-full px-4 py-2 rounded text-sm font-medium
          ${isRunning
            ? 'bg-orange-700 hover:bg-orange-600 text-white'
            : 'bg-amber-700 hover:bg-amber-600 text-white'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
        `}
      >
        {isRunning ? 'Stop' : 'Start'}
      </button>

      {/* Speed Slider */}
      <div>
        <label className="text-sm font-medium mb-2 block">
          Speed: <span style={{ fontFamily: 'var(--font-mono)' }}>{speed}</span>
        </label>
        <input
          type="range"
          min={1}
          max={100}
          value={speed}
          onChange={(e) => onParamChange({ speed: parseInt(e.target.value) })}
          disabled={!isConnected}
          className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ accentColor: '#b45309' }}
        />
      </div>

      {/* Min Position Slider */}
      <div>
        <label className="text-sm font-medium mb-2 block">
          Min Position: <span style={{ fontFamily: 'var(--font-mono)' }}>{minY}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={99}
          value={minY}
          onChange={(e) => onParamChange({ minY: parseInt(e.target.value) })}
          disabled={!isConnected}
          className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ accentColor: '#b45309' }}
        />
      </div>

      {/* Max Position Slider */}
      <div>
        <label className="text-sm font-medium mb-2 block">
          Max Position: <span style={{ fontFamily: 'var(--font-mono)' }}>{maxY}%</span>
        </label>
        <input
          type="range"
          min={1}
          max={100}
          value={maxY}
          onChange={(e) => onParamChange({ maxY: parseInt(e.target.value) })}
          disabled={!isConnected}
          className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ accentColor: '#b45309' }}
        />
      </div>

      {/* Increment Slider */}
      <div>
        <label className="text-sm font-medium mb-2 block">
          Step Size: <span style={{ fontFamily: 'var(--font-mono)' }}>{increment}</span>
          {patternType === 'oscillation' && (
            <span className="text-xs text-stone-500 ml-2">
              (SDK oscillation uses fixed steps)
            </span>
          )}
        </label>
        <input
          type="range"
          min={1}
          max={50}
          value={increment}
          onChange={(e) => onParamChange({ increment: parseInt(e.target.value) })}
          disabled={incrementDisabled}
          className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ accentColor: '#b45309' }}
        />
      </div>

      {/* Variability Slider */}
      <div>
        <label className="text-sm font-medium mb-2 block">
          Variability: <span style={{ fontFamily: 'var(--font-mono)' }}>{variability}%</span>
          {patternType === 'oscillation' && (
            <span className="text-xs text-stone-500 ml-2">
              (SDK oscillation has no variability)
            </span>
          )}
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={variability}
          onChange={(e) => onParamChange({ variability: parseInt(e.target.value) })}
          disabled={variabilityDisabled}
          className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ accentColor: '#b45309' }}
        />
      </div>
    </div>
  );
}
