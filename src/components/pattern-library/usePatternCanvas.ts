import { useRef, useState, useEffect } from 'react';

/**
 * Hook managing shared canvas infrastructure for pattern editor dialogs:
 * resize observer tracking container width, and drag state.
 */
export function usePatternCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(600);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      setCanvasWidth(entries[0].contentRect.width);
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return { canvasRef, containerRef, canvasWidth, draggedIndex, setDraggedIndex };
}
