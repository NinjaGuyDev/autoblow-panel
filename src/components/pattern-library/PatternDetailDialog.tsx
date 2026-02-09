import { useEffect, useRef, useState, useCallback } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';
import type { PatternDefinition } from '@/types/patterns';
import { getPatternDirection } from '@/lib/patternDefinitions';
import { createSmoothTransition } from '@/lib/patternInsertion';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/getErrorMessage';

interface PatternDetailDialogProps {
  pattern: PatternDefinition | null;
  isOpen: boolean;
  onClose: () => void;
  onInsert: (pattern: PatternDefinition) => void;
  onEditCopy?: (pattern: PatternDefinition) => void;
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
  ultra,
  isDeviceConnected,
}: PatternDetailDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  // Draw pattern with animated playhead
  const drawAnimated = (currentTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !pattern) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const actions = pattern.generator();
    if (actions.length === 0) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw pattern line
    ctx.strokeStyle = '#8b5cf6';
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
      let actions = pattern.generator();

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

      // Create funscript object with looping
      const funscript = {
        version: '1.0',
        inverted: false,
        range: 100,
        actions: actions,
      };

      // Upload to device
      await ultra.syncScriptUploadFunscriptFile(funscript);

      // Start playback from beginning (will loop automatically)
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

  if (!isOpen || !pattern) return null;

  const direction = getPatternDirection(pattern);

  // Intensity badge color
  const intensityColor = {
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
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
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Canvas preview */}
        <canvas
          ref={canvasRef}
          width={400}
          height={200}
          className="w-full h-auto mb-4 rounded border border-muted/50"
        />

        {/* Pattern name */}
        <h2 className="text-xl font-semibold text-foreground mb-3">
          {pattern.name}
        </h2>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
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
            <label className="text-xs text-muted-foreground block mb-1">
              Duration
            </label>
            <span className="text-sm text-foreground">
              {(pattern.durationMs / 1000).toFixed(1)}s
            </span>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Direction
            </label>
            <span className="text-sm text-foreground capitalize">
              {direction}
            </span>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Actions
            </label>
            <span className="text-sm text-foreground">
              {pattern.generator().length}
            </span>
          </div>
        </div>

        {/* Tags */}
        <div className="mb-6">
          <label className="text-xs text-muted-foreground block mb-2">
            Style Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {pattern.tags.map((tag) => (
              <span
                key={tag}
                className="text-sm px-2 py-1 rounded bg-muted/50 text-muted-foreground"
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
            className="flex-1 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium shadow-sm"
          >
            Insert Pattern
          </button>

          {onEditCopy && (
            <button
              onClick={() => {
                onEditCopy(pattern);
                onClose();
              }}
              className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors font-medium shadow-sm"
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
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              )}
            >
              {isDemoPlaying ? 'Stop Demo' : 'Demo'}
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-zinc-600 text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
