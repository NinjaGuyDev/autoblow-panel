interface ManualSyncControlsProps {
  offsetMs: number;
  onOffsetChange: (offset: number) => void;
  onReset: () => void;
  stepMs: number;
}

/**
 * UI component for manual sync offset adjustment
 * Displays offset and provides buttons for fine-tuning timing
 */
export function ManualSyncControls({
  offsetMs,
  onOffsetChange,
  onReset,
  stepMs,
}: ManualSyncControlsProps) {
  const formatOffset = (ms: number): string => {
    return `${ms > 0 ? '+' : ''}${ms}ms`;
  };

  const handleDecrement = () => {
    onOffsetChange(offsetMs - stepMs);
  };

  const handleIncrement = () => {
    onOffsetChange(offsetMs + stepMs);
  };

  return (
    <div className="space-y-3">
      {/* Warning banner */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3">
        <p className="text-sm text-yellow-200">
          Auto-sync not available for this platform
        </p>
      </div>

      {/* Offset controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handleDecrement}
          className="px-3 py-1 text-sm bg-muted text-muted-foreground hover:bg-muted/80 rounded-md transition-colors"
        >
          -{stepMs}ms
        </button>

        <div className="font-mono text-lg text-foreground min-w-[80px] text-center">
          {formatOffset(offsetMs)}
        </div>

        <button
          onClick={handleIncrement}
          className="px-3 py-1 text-sm bg-muted text-muted-foreground hover:bg-muted/80 rounded-md transition-colors"
        >
          +{stepMs}ms
        </button>

        <button
          onClick={onReset}
          className="px-3 py-1 text-sm bg-muted text-muted-foreground hover:bg-muted/80 rounded-md transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground mt-2 text-center">
        Use Up/Down arrow keys to adjust sync timing
      </p>
    </div>
  );
}
