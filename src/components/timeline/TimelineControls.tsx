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
  smoothingActive?: boolean;
  onSmoothingToggle?: () => void;
  smoothingIntensity?: number;
  onSmoothingIntensityChange?: (value: number) => void;
  isPreviewActive?: boolean;
  onSmoothingPreview?: () => void;
  onSmoothingApply?: () => void;
  onSmoothingCancel?: () => void;
  smoothingStats?: { originalCount: number; smoothedCount: number } | null;
  hasSelection?: boolean;
  humanizerActive?: boolean;
  onHumanizerToggle?: () => void;
  humanizerIntensity?: number;
  onHumanizerIntensityChange?: (value: number) => void;
  isHumanizerPreviewActive?: boolean;
  onHumanizerPreview?: () => void;
  onHumanizerApply?: () => void;
  onHumanizerCancel?: () => void;
  humanizerStats?: { affectedCount: number; totalCount: number } | null;
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
  smoothingActive,
  onSmoothingToggle,
  smoothingIntensity,
  onSmoothingIntensityChange,
  isPreviewActive,
  onSmoothingPreview,
  onSmoothingApply,
  onSmoothingCancel,
  smoothingStats,
  hasSelection,
  humanizerActive,
  onHumanizerToggle,
  humanizerIntensity,
  onHumanizerIntensityChange,
  isHumanizerPreviewActive,
  onHumanizerPreview,
  onHumanizerApply,
  onHumanizerCancel,
  humanizerStats,
}: TimelineControlsProps) {
  const isEditMode = !!editMode;

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-stone-800 bg-stone-900/50">
        {/* Left: Action point toggle and edit mode controls */}
        <div className="flex items-center gap-3">
          {!isEditMode && (
            <label className="flex items-center gap-2 text-sm text-stone-500 cursor-pointer">
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
            <div className="flex items-center gap-1 bg-stone-800/30 rounded p-1">
              <button
                onClick={() => onEditModeChange('select')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  editMode === 'select'
                    ? 'bg-amber-700 text-white'
                    : 'text-stone-500 hover:text-stone-200'
                }`}
                title="Select mode (V)"
              >
                Select
              </button>
              <button
                onClick={() => onEditModeChange('draw')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  editMode === 'draw'
                    ? 'bg-amber-700 text-white'
                    : 'text-stone-500 hover:text-stone-200'
                }`}
                title="Draw mode (D)"
              >
                Draw
              </button>
            </div>
          )}

          {isEditMode && onSmoothingToggle && (
            <button
              onClick={onSmoothingToggle}
              className={`px-2 py-1 text-sm rounded transition-colors ${
                smoothingActive
                  ? 'bg-amber-700 text-white'
                  : 'text-stone-500 hover:text-stone-200 hover:bg-stone-800'
              }`}
              title="Smooth script"
            >
              Smooth
            </button>
          )}

          {isEditMode && onHumanizerToggle && (
            <button
              onClick={onHumanizerToggle}
              className={`px-2 py-1 text-sm rounded transition-colors ${
                humanizerActive
                  ? 'bg-teal-700 text-white'
                  : 'text-stone-500 hover:text-stone-200 hover:bg-stone-800'
              }`}
              title="Humanize repetitive patterns"
            >
              Humanize
            </button>
          )}
        </div>

      {/* Center: Undo/Redo controls (in edit mode) */}
      {isEditMode && (
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="px-2 py-1 text-sm text-stone-500 hover:text-stone-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="px-2 py-1 text-sm text-stone-500 hover:text-stone-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
            className="px-2 py-1 text-sm text-stone-500 hover:text-stone-200 hover:bg-stone-800 rounded transition-colors mr-2"
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
              <span className="text-stone-400" title={`${validationSummary.gapCount} gap(s) longer than 3 seconds`}>
                {validationSummary.gapCount} gap{validationSummary.gapCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
        <button
          onClick={onZoomOut}
          className="px-2 py-1 text-sm text-stone-500 hover:text-stone-200 hover:bg-stone-800 rounded transition-colors"
          title="Zoom out"
        >
          -
        </button>
        <button
          onClick={onZoomFit}
          className="px-2 py-1 text-sm text-stone-500 hover:text-stone-200 hover:bg-stone-800 rounded transition-colors"
          title="Fit entire script"
        >
          Fit
        </button>
        <button
          onClick={onZoomIn}
          className="px-2 py-1 text-sm text-stone-500 hover:text-stone-200 hover:bg-stone-800 rounded transition-colors"
          title="Zoom in"
        >
          +
        </button>
      </div>
    </div>

    {/* Smoothing control strip */}
    {isEditMode && smoothingActive && (
      <div className="flex items-center justify-between px-3 py-2 border-b border-stone-800 bg-stone-900/50">
        <div className="flex items-center gap-3 flex-1">
          {/* Label */}
          <span className="text-sm font-medium">Smoothing</span>

          {/* Intensity slider */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <span className="text-xs text-stone-500">Intensity:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={smoothingIntensity ?? 50}
              onChange={(e) => onSmoothingIntensityChange?.(parseInt(e.target.value))}
              className="flex-1"
              style={{ accentColor: '#b45309' }}
            />
            <span className="text-xs text-stone-500 w-8 text-right">
              {smoothingIntensity ?? 50}
            </span>
          </div>

          {/* Scope indicator */}
          <span className="text-xs text-stone-500">
            {hasSelection ? `Selection (${selectedCount} points)` : 'Entire script'}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Stats display */}
          {isPreviewActive && smoothingStats && (
            <span className="text-xs text-stone-500 mr-2">
              {smoothingStats.originalCount} → {smoothingStats.smoothedCount} actions
            </span>
          )}

          <button
            onClick={onSmoothingPreview}
            disabled={isPreviewActive}
            className="px-3 py-1 text-sm text-stone-500 hover:text-stone-200 hover:bg-stone-800 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Preview smoothing result"
          >
            Preview
          </button>
          <button
            onClick={onSmoothingApply}
            disabled={!isPreviewActive}
            className="px-3 py-1 text-sm bg-amber-700 text-white hover:bg-amber-600 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Apply smoothing"
          >
            Apply
          </button>
          <button
            onClick={onSmoothingCancel}
            className="px-3 py-1 text-sm text-stone-500 hover:text-stone-200 hover:bg-stone-800 rounded transition-colors"
            title="Cancel smoothing"
          >
            Cancel
          </button>
        </div>
      </div>
    )}

    {/* Humanizer control strip */}
    {isEditMode && humanizerActive && (
      <div className="flex items-center justify-between px-3 py-2 border-b border-stone-800 bg-teal-950/40">
        <div className="flex items-center gap-3 flex-1">
          {/* Label */}
          <span className="text-sm font-medium text-teal-300">Humanize</span>

          {/* Intensity slider */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <span className="text-xs text-stone-500">Variation:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={humanizerIntensity ?? 50}
              onChange={(e) => onHumanizerIntensityChange?.(parseInt(e.target.value))}
              className="flex-1"
              style={{ accentColor: '#0d9488' }}
            />
            <span className="text-xs text-stone-500 w-8 text-right">
              {humanizerIntensity ?? 50}
            </span>
          </div>

          {/* Scope indicator */}
          <span className="text-xs text-stone-500">
            {hasSelection ? `Selection (${selectedCount} points)` : 'Entire script'}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Stats display */}
          {isHumanizerPreviewActive && humanizerStats && (
            <span className="text-xs text-stone-500 mr-2">
              {humanizerStats.affectedCount} action{humanizerStats.affectedCount !== 1 ? 's' : ''} varied
            </span>
          )}

          <button
            onClick={onHumanizerPreview}
            disabled={isHumanizerPreviewActive}
            className="px-3 py-1 text-sm text-stone-500 hover:text-stone-200 hover:bg-stone-800 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Preview humanization result"
          >
            Preview
          </button>
          <button
            onClick={onHumanizerApply}
            disabled={!isHumanizerPreviewActive}
            className="px-3 py-1 text-sm bg-teal-700 text-white hover:bg-teal-600 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Apply humanization"
          >
            Apply
          </button>
          <button
            onClick={onHumanizerCancel}
            className="px-3 py-1 text-sm text-stone-500 hover:text-stone-200 hover:bg-stone-800 rounded transition-colors"
            title="Cancel humanization"
          >
            Cancel
          </button>
        </div>
      </div>
    )}
  </>
  );
}
