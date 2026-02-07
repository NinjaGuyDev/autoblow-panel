import { useEffect, useRef } from 'react';
import type { PatternDefinition } from '@/types/patterns';
import { getPatternDirection } from '@/lib/patternDefinitions';
import { cn } from '@/lib/utils';

interface PatternDetailDialogProps {
  pattern: PatternDefinition | null;
  isOpen: boolean;
  onClose: () => void;
  onInsert: (pattern: PatternDefinition) => void;
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
}: PatternDetailDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

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
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-card border border-muted rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
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

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => onInsert(pattern)}
            className="flex-1 px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
          >
            Insert Pattern
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-muted text-foreground hover:bg-muted/50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
