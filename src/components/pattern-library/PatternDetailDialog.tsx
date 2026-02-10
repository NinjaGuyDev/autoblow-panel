import { useEffect, useRef, useState, useCallback } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';
import { type AnyPattern, isCustomPattern, getPatternActions } from '@/types/patterns';
import { getPatternDirection } from '@/lib/patternDefinitions';
import { createSmoothTransition } from '@/lib/patternInsertion';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { useDemoLoop } from '@/hooks/useDemoLoop';

interface PatternDetailDialogProps {
  pattern: AnyPattern | null;
  isOpen: boolean;
  onClose: () => void;
  onInsert: (pattern: AnyPattern) => void;
  onEditCopy?: (pattern: AnyPattern) => void;
  onEdit?: (pattern: AnyPattern) => void;
  onDelete?: (pattern: AnyPattern) => void;
  ultra: Ultra | null;
  isDeviceConnected: boolean;
}

/**
 * Modal dialog with larger animated preview and pattern metadata
 * Animation plays automatically when dialog opens
 */
export function PatternDetailDialog({
  pattern,
  isOpen,
  onClose,
  onInsert,
  onEditCopy,
  onEdit,
  onDelete,
  ultra,
  isDeviceConnected,
}: PatternDetailDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [scriptDurationMs, setScriptDurationMs] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useDemoLoop(ultra, isDemoPlaying, scriptDurationMs);

  // Draw pattern with animated playhead
  const drawAnimated = (currentTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !pattern) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const actions = getPatternActions(pattern);
    if (actions.length === 0) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw pattern line
    ctx.strokeStyle = '#c8956c'; // Warm amber
    ctx.lineWidth = 3;
    ctx.beginPath();

    const maxTime = Math.max(...actions.map((a) => a.at));

    actions.forEach((action, i) => {
      const x = (action.at / maxTime) * canvas.width;
      const y = canvas.height - (action.pos / 100) * canvas.height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw playhead (looping)
    const progress = (currentTime % pattern.durationMs) / pattern.durationMs;
    const playheadX = progress * canvas.width;

    ctx.strokeStyle = '#ef4444'; // Red playhead
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, canvas.height);
    ctx.stroke();
  };

  // Animation loop
  useEffect(() => {
    if (!isOpen || !pattern) {
      // Cleanup when closed
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      startTimeRef.current = null;
      return;
    }

    // Start animation loop
    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      drawAnimated(elapsed);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      startTimeRef.current = null;
    };
  }, [isOpen, pattern]);

  // Demo playback handlers
  const startDemo = useCallback(async () => {
    if (!ultra || !pattern) return;

    try {
      setDemoError(null);

      // Generate pattern actions
      let actions = getPatternActions(pattern);

      // Add smoothing at the end if pattern ends at different position than it starts
      if (actions.length > 0) {
        const firstPos = actions[0].pos;
        const lastAction = actions[actions.length - 1];
        const lastPos = lastAction.pos;
        const lastTime = lastAction.at;

        // Add smooth transition back to start position for seamless looping
        if (firstPos !== lastPos) {
          const smoothingActions = createSmoothTransition(
            lastPos,
            firstPos,
            lastTime
          );
          actions = [...actions, ...smoothingActions];
        }
      }

      // Track script duration for loop detection
      setScriptDurationMs(actions[actions.length - 1].at);

      // Create funscript object
      const funscript = {
        version: '1.0',
        inverted: false,
        range: 100,
        actions: actions,
      };

      // Upload to device
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ultra.syncScriptUploadFunscriptFile(funscript as any);

      // Start playback from beginning
      await ultra.syncScriptStart(0);

      setIsDemoPlaying(true);
    } catch (err) {
      setDemoError(getErrorMessage(err, 'Failed to start demo'));
    }
  }, [ultra, pattern]);

  const stopDemo = useCallback(async () => {
    if (!ultra) return;

    try {
      await ultra.syncScriptStop();
      setIsDemoPlaying(false);
      setScriptDurationMs(0);
      setDemoError(null);
    } catch (err) {
      setDemoError(getErrorMessage(err, 'Failed to stop demo'));
    }
  }, [ultra]);

  // Stop demo when dialog closes
  useEffect(() => {
    if (!isOpen && isDemoPlaying) {
      stopDemo();
    }
  }, [isOpen, isDemoPlaying, stopDemo]);

  // Reset delete confirmation when dialog opens/closes
  useEffect(() => {
    setShowDeleteConfirm(false);
  }, [isOpen]);

  if (!isOpen || !pattern) return null;

  const direction = getPatternDirection(pattern);

  // Intensity badge color
  const intensityColor = {
    low: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    medium: 'bg-amber-900/30 text-amber-400 border-amber-800/40',
    high: 'bg-orange-900/30 text-orange-400 border-orange-800/40',
  }[pattern.intensity];

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-stone-900 border border-stone-700 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Canvas preview */}
        <canvas
          ref={canvasRef}
          width={400}
          height={200}
          className="w-full h-auto mb-4 rounded border border-stone-800/50"
        />

        {/* Pattern name */}
        <h2 className="text-xl font-semibold text-stone-200 mb-3" style={{ fontFamily: 'var(--font-display)' }}>
          {pattern.name}
        </h2>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-stone-500 block mb-1">
              Intensity
            </label>
            <span
              className={cn(
                'inline-block text-sm px-3 py-1 rounded border',
                intensityColor
              )}
            >
              {pattern.intensity}
            </span>
          </div>

          <div>
            <label className="text-xs text-stone-500 block mb-1">
              Duration
            </label>
            <span className="text-sm text-stone-200" style={{ fontFamily: 'var(--font-mono)' }}>
              {(pattern.durationMs / 1000).toFixed(1)}s
            </span>
          </div>

          <div>
            <label className="text-xs text-stone-500 block mb-1">
              Direction
            </label>
            <span className="text-sm text-stone-200 capitalize">
              {direction}
            </span>
          </div>

          <div>
            <label className="text-xs text-stone-500 block mb-1">
              Actions
            </label>
            <span className="text-sm text-stone-200">
              {getPatternActions(pattern).length}
            </span>
          </div>
        </div>

        {/* Tags */}
        <div className="mb-6">
          <label className="text-xs text-stone-500 block mb-2">
            Style Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {pattern.tags.map((tag) => (
              <span
                key={tag}
                className="text-sm px-2 py-1 rounded bg-stone-800/60 text-stone-500"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Error message */}
        {demoError && (
          <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            {demoError}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => onInsert(pattern)}
            className="flex-1 px-4 py-2 rounded bg-amber-700 text-white hover:bg-amber-600 transition-colors font-medium shadow-sm"
          >
            Insert Pattern
          </button>

          {onEdit && isCustomPattern(pattern) && (
            <button
              onClick={() => {
                onEdit(pattern);
                onClose();
              }}
              className="px-4 py-2 rounded bg-stone-700 text-white hover:bg-stone-600 transition-colors font-medium shadow-sm"
            >
              Edit
            </button>
          )}

          {onEditCopy && (
            <button
              onClick={() => {
                onEditCopy(pattern);
                onClose();
              }}
              className="px-4 py-2 rounded bg-stone-700 text-white hover:bg-stone-600 transition-colors font-medium shadow-sm"
            >
              Edit Copy
            </button>
          )}

          {isDeviceConnected && (
            <button
              onClick={isDemoPlaying ? stopDemo : startDemo}
              className={cn(
                'px-4 py-2 rounded font-medium shadow-sm transition-colors',
                isDemoPlaying
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-stone-600 text-white hover:bg-stone-500'
              )}
            >
              {isDemoPlaying ? 'Stop Demo' : 'Demo'}
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-stone-600 text-stone-200 hover:bg-stone-800 transition-colors"
          >
            Close
          </button>

          {onDelete && isCustomPattern(pattern) && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 rounded border border-red-800/50 text-red-400 hover:bg-red-900/30 transition-colors"
            >
              Delete
            </button>
          )}
        </div>

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="mt-4 p-3 rounded bg-red-900/20 border border-red-800/40">
            <p className="text-sm text-red-300 mb-3">
              Are you sure you want to delete &ldquo;{pattern.name}&rdquo;?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  onDelete?.(pattern);
                  onClose();
                }}
                className="px-4 py-2 rounded bg-red-700 text-white hover:bg-red-600 transition-colors font-medium text-sm"
              >
                Confirm Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded border border-stone-600 text-stone-200 hover:bg-stone-800 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
