interface TimelineControlsProps {
  showActionPoints: boolean;
  onToggleActionPoints: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
}

export function TimelineControls({
  showActionPoints,
  onToggleActionPoints,
  onZoomIn,
  onZoomOut,
  onZoomFit,
}: TimelineControlsProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-muted bg-card">
      {/* Left: Action point toggle */}
      <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={showActionPoints}
          onChange={onToggleActionPoints}
          className="cursor-pointer"
        />
        <span>Show points</span>
      </label>

      {/* Right: Zoom controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onZoomOut}
          className="px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
          title="Zoom out"
        >
          -
        </button>
        <button
          onClick={onZoomFit}
          className="px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
          title="Fit entire script"
        >
          Fit
        </button>
        <button
          onClick={onZoomIn}
          className="px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
          title="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  );
}
