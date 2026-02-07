import { useRef, useEffect } from 'react';
import type { FunscriptAction } from '@/types/funscript';

interface CreationFooterProps {
  actions: FunscriptAction[];
  onClose: () => void;
  onExport: () => void;
}

/**
 * Sticky footer showing timeline for script creation mode
 * Displays actions added via pattern insertion
 */
export function CreationFooter({ actions, onClose, onExport }: CreationFooterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw mini timeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (actions.length === 0) {
      // Show empty state
      ctx.fillStyle = '#71717a'; // zinc-500
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Insert patterns to build your script', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Draw pattern line
    const maxTime = Math.max(...actions.map((a) => a.at), 1);
    ctx.strokeStyle = '#8b5cf6'; // purple
    ctx.lineWidth = 2;
    ctx.beginPath();

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

    // Draw action count
    ctx.fillStyle = '#a1a1aa'; // zinc-400
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${actions.length} actions • ${(maxTime / 1000).toFixed(1)}s`, 10, 20);
  }, [actions]);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-700 shadow-2xl z-40">
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-sm font-medium text-zinc-200">New Script</span>
          <canvas
            ref={canvasRef}
            width={600}
            height={80}
            className="flex-1 max-w-3xl rounded border border-zinc-700 bg-zinc-950"
          />
        </div>
        <div className="flex gap-2 ml-4">
          <button
            onClick={onExport}
            disabled={actions.length === 0}
            className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export Script
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded border border-zinc-600 text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
