import { useEffect, useRef, useState, memo } from 'react';
import type { PatternDefinition } from '@/types/patterns';
import { cn } from '@/lib/utils';

interface PatternCardProps {
  pattern: PatternDefinition;
  onClick: () => void;
  isCreationMode?: boolean;
  onQuickAdd?: () => void;
}

/**
 * Pattern card with canvas preview and hover-triggered animation
 * Memoized to prevent re-renders of non-hovered cards
 */
export const PatternCard = memo(function PatternCard({
  pattern,
  onClick,
  isCreationMode = false,
  onQuickAdd,
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
    ctx.strokeStyle = '#c8956c'; // Warm amber
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
    ctx.strokeStyle = '#c8956c'; // Warm amber
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

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onQuickAdd) {
      onQuickAdd();
    }
  };

  // Intensity badge color
  const intensityColor = {
    low: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    medium: 'bg-amber-900/30 text-amber-400 border-amber-800/40',
    high: 'bg-orange-900/30 text-orange-400 border-orange-800/40',
  }[pattern.intensity];

  return (
    <div
      className={cn(
        'border border-stone-800 rounded-lg p-4 bg-stone-900/50 cursor-pointer transition-colors relative',
        'hover:border-stone-600 hover:bg-stone-900/80'
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Quick add button (creation mode only) */}
      {isCreationMode && (
        <button
          onClick={handleQuickAdd}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-amber-700 hover:bg-amber-600 text-white flex items-center justify-center transition-colors shadow-lg z-10"
          title="Quick add to end"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      )}

      {/* Canvas preview */}
      <canvas
        ref={canvasRef}
        width={240}
        height={120}
        className="w-full h-auto mb-3 rounded border border-stone-800/50"
      />

      {/* Pattern name */}
      <h3 className="text-sm font-medium text-stone-200 mb-2">
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
        <span className="text-xs text-stone-500" style={{ fontFamily: 'var(--font-mono)' }}>
          {(pattern.durationMs / 1000).toFixed(1)}s
        </span>
      </div>

      {/* Style tags */}
      <div className="flex flex-wrap gap-1">
        {pattern.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="text-xs px-1.5 py-0.5 rounded bg-stone-800/60 text-stone-500"
          >
            {tag}
          </span>
        ))}
        {pattern.tags.length > 3 && (
          <span className="text-xs text-stone-500">
            +{pattern.tags.length - 3}
          </span>
        )}
      </div>
    </div>
  );
});
