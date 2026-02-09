interface ManualSyncControlsProps {
  offsetMs: number;
  onOffsetChange: (offset: number) => void;
  onReset: () => void;
  stepMs: number;
  isScriptPlaying?: boolean;
  onToggleScript?: () => void;
}

/**
 * UI for manual sync: start/stop funscript button, offset adjustment, workflow instructions.
 * Shown for iframe-embed platforms where we can't control playback programmatically.
 */
export function ManualSyncControls({
  offsetMs,
  onOffsetChange,
  onReset,
  stepMs,
  isScriptPlaying = false,
  onToggleScript,
}: ManualSyncControlsProps) {
  const formatOffset = (ms: number): string => {
    return `${ms > 0 ? '+' : ''}${ms}ms`;
  };

  return (
    <div className="space-y-3">
      {/* Workflow instructions */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 space-y-1">
        <p className="text-sm font-medium text-yellow-200">Manual sync mode</p>
        <ol className="text-xs text-yellow-200/80 list-decimal list-inside space-y-0.5">
          <li>Press play on the embedded video</li>
          <li>Click Start Funscript below</li>
          <li>Adjust offset with arrows if timing is off</li>
        </ol>
      </div>

      {/* Start/Stop funscript button */}
      {onToggleScript && (
        <button
          onClick={onToggleScript}
          className={`w-full py-2.5 text-sm font-medium rounded-md transition-colors ${
            isScriptPlaying
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
              : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
          }`}
        >
          {isScriptPlaying ? 'Stop Funscript' : 'Start Funscript'}
        </button>
      )}

      {/* Offset controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => onOffsetChange(offsetMs - stepMs)}
          className="px-3 py-1 text-sm bg-muted text-muted-foreground hover:bg-muted/80 rounded-md transition-colors"
        >
          -{stepMs}ms
        </button>

        <div className="font-mono text-lg text-foreground min-w-[80px] text-center">
          {formatOffset(offsetMs)}
        </div>

        <button
          onClick={() => onOffsetChange(offsetMs + stepMs)}
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
