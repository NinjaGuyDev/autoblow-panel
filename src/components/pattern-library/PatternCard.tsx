import { useEffect, useRef, useState, memo } from 'react';
import type { PatternDefinition } from '@/types/patterns';
import { cn } from '@/lib/utils';

interface PatternCardProps {
  pattern: PatternDefinition;
  onClick: () => void;
}

/**
 * Pattern card with canvas preview and hover-triggered animation
 * Memoized to prevent re-renders of non-hovered cards
 */
export const PatternCard = memo(function PatternCard({
  pattern,
  onClick,
}: PatternCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Draw static pattern graph
  const drawStatic = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const actions = pattern.generator();
    if (actions.length === 0) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw pattern line
    ctx.strokeStyle = '#8b5cf6'; // Primary color
    ctx.lineWidth = 2;
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
  };

  // Draw pattern with animated playhead
  const drawAnimated = (currentTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const actions = pattern.generator();
    if (actions.length === 0) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw pattern line
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2;
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
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, canvas.height);
    ctx.stroke();
  };

  // Animation loop
  useEffect(() => {
    if (!isHovered) {
      // Draw static when not hovered
      drawStatic();
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
  }, [isHovered, pattern]);

  // Initial static render
  useEffect(() => {
    drawStatic();
  }, [pattern]);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleClick = () => {
    // Clear hover state to prevent animation leak
    setIsHovered(false);
    onClick();
  };

  // Intensity badge color
  const intensityColor = {
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
  }[pattern.intensity];

  return (
    <div
      className={cn(
        'border border-muted rounded-lg p-4 bg-card cursor-pointer transition-colors',
        'hover:border-primary/50 hover:bg-card/80'
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Canvas preview */}
      <canvas
        ref={canvasRef}
        width={240}
        height={120}
        className="w-full h-auto mb-3 rounded border border-muted/50"
      />

      {/* Pattern name */}
      <h3 className="text-sm font-medium text-foreground mb-2">
        {pattern.name}
      </h3>

      {/* Metadata row */}
      <div className="flex items-center gap-2 mb-2">
        {/* Intensity badge */}
        <span
          className={cn(
            'text-xs px-2 py-0.5 rounded border',
            intensityColor
          )}
        >
          {pattern.intensity}
        </span>

        {/* Duration */}
        <span className="text-xs text-muted-foreground">
          {(pattern.durationMs / 1000).toFixed(1)}s
        </span>
      </div>

      {/* Style tags */}
      <div className="flex flex-wrap gap-1">
        {pattern.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="text-xs px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground"
          >
            {tag}
          </span>
        ))}
        {pattern.tags.length > 3 && (
          <span className="text-xs text-muted-foreground">
            +{pattern.tags.length - 3}
          </span>
        )}
      </div>
    </div>
  );
});
