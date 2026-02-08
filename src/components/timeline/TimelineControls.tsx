import type { EditMode } from '@/types/timeline';
import type { ValidationResult } from '@/types/validation';

interface TimelineControlsProps {
  showActionPoints: boolean;
  onToggleActionPoints: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  editMode?: EditMode;
  onEditModeChange?: (mode: EditMode) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onExport?: () => void;
  selectedCount?: number;
  onDeleteSelected?: () => void;
  validationSummary?: ValidationResult['summary'];
}

export function TimelineControls({
  showActionPoints,
  onToggleActionPoints,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  editMode,
  onEditModeChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExport,
  selectedCount,
  onDeleteSelected,
  validationSummary,
}: TimelineControlsProps) {
  const isEditMode = !!editMode;

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-muted bg-card">
      {/* Left: Action point toggle and edit mode controls */}
      <div className="flex items-center gap-3">
        {!isEditMode && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={showActionPoints}
              onChange={onToggleActionPoints}
              className="cursor-pointer"
            />
            <span>Show points</span>
          </label>
        )}

        {isEditMode && onEditModeChange && (
          <div className="flex items-center gap-1 bg-muted/30 rounded p-1">
            <button
              onClick={() => onEditModeChange('select')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                editMode === 'select'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Select mode (V)"
            >
              Select
            </button>
            <button
              onClick={() => onEditModeChange('draw')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                editMode === 'draw'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Draw mode (D)"
            >
              Draw
            </button>
          </div>
        )}
      </div>

      {/* Center: Undo/Redo controls (in edit mode) */}
      {isEditMode && (
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="px-2 py-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="px-2 py-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Redo (Ctrl+Shift+Z)"
          >
            ↷ Redo
          </button>
          {selectedCount !== undefined && selectedCount > 0 && onDeleteSelected && (
            <button
              onClick={onDeleteSelected}
              className="px-2 py-1 text-sm text-red-400 hover:text-red-300 transition-colors ml-2"
              title="Delete selected (Delete)"
            >
              Delete ({selectedCount})
            </button>
          )}
        </div>
      )}

      {/* Right: Export, Validation summary, and Zoom controls */}
      <div className="flex items-center gap-1">
        {isEditMode && onExport && (
          <button
            onClick={onExport}
            className="px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors mr-2"
            title="Export funscript"
          >
            ↓ Export
          </button>
        )}
        {validationSummary && (validationSummary.fastCount > 0 || validationSummary.impossibleCount > 0 || validationSummary.gapCount > 0) && (
          <div className="flex items-center gap-2 text-xs mr-3">
            {validationSummary.impossibleCount > 0 && (
              <span className="text-red-400" title={`${validationSummary.impossibleCount} segment(s) exceed device capabilities`}>
                {validationSummary.impossibleCount} impossible
              </span>
            )}
            {validationSummary.fastCount > 0 && (
              <span className="text-yellow-400" title={`${validationSummary.fastCount} segment(s) are fast but achievable`}>
                {validationSummary.fastCount} fast
              </span>
            )}
            {validationSummary.gapCount > 0 && (
              <span className="text-zinc-400" title={`${validationSummary.gapCount} gap(s) longer than 3 seconds`}>
                {validationSummary.gapCount} gap{validationSummary.gapCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
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
