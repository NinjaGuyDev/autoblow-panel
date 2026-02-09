import { useRef, useEffect, useState, useCallback } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';
import type { FunscriptAction } from '@/types/funscript';
import { createSmoothTransition } from '@/lib/patternInsertion';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { useDemoLoop } from '@/hooks/useDemoLoop';
import { cn } from '@/lib/utils';

interface CreationFooterProps {
  scriptName: string;
  actions: FunscriptAction[];
  onClose: () => void;
  onExport: () => void;
  ultra: Ultra | null;
  isDeviceConnected: boolean;
}

/**
 * Sticky footer showing timeline for script creation mode.
 * Includes a demo button that uploads the current script to the device
 * with smooth looping, matching the pattern library demo behavior.
 */
export function CreationFooter({
  scriptName,
  actions,
  onClose,
  onExport,
  ultra,
  isDeviceConnected,
}: CreationFooterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [scriptDurationMs, setScriptDurationMs] = useState(0);

  useDemoLoop(ultra, isDemoPlaying, scriptDurationMs);

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
      ctx.fillStyle = '#78716c'; // stone-500
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Insert patterns to build your script', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Draw pattern line
    const maxTime = Math.max(...actions.map((a) => a.at), 1);
    ctx.strokeStyle = '#c8956c'; // warm amber
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

    // Draw action count with background
    const text = `${actions.length} actions \u2022 ${(maxTime / 1000).toFixed(1)}s`;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';

    // Measure text to size background
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const padding = 6;

    // Draw semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10 - padding / 2, 20 - 12 - padding / 2, textWidth + padding, 12 + padding);

    // Draw text
    ctx.fillStyle = '#a8a29e'; // stone-400
    ctx.fillText(text, 10, 20);
  }, [actions]);

  const startDemo = useCallback(async () => {
    if (!ultra || actions.length === 0) return;

    try {
      setDemoError(null);

      let demoActions = [...actions];

      // Add smooth transition back to start position for seamless looping
      if (demoActions.length > 1) {
        const firstPos = demoActions[0].pos;
        const lastAction = demoActions[demoActions.length - 1];

        if (firstPos !== lastAction.pos) {
          const smoothingActions = createSmoothTransition(
            lastAction.pos,
            firstPos,
            lastAction.at,
          );
          demoActions = [...demoActions, ...smoothingActions];
        }
      }

      setScriptDurationMs(demoActions[demoActions.length - 1].at);

      const funscript = {
        version: '1.0',
        inverted: false,
        range: 100,
        actions: demoActions,
      };

      await ultra.syncScriptUploadFunscriptFile(funscript);
      await ultra.syncScriptStart(0);

      setIsDemoPlaying(true);
    } catch (err) {
      setDemoError(getErrorMessage(err, 'Failed to start demo'));
    }
  }, [ultra, actions]);

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

  // Stop demo when footer closes
  useEffect(() => {
    return () => {
      if (isDemoPlaying && ultra) {
        ultra.syncScriptStop().catch(() => {});
      }
    };
  }, [isDemoPlaying, ultra]);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-stone-900 border-t border-stone-800 shadow-2xl z-40">
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-sm font-medium text-stone-200">{scriptName || 'Untitled Script'}</span>
          <canvas
            ref={canvasRef}
            width={600}
            height={80}
            className="flex-1 max-w-3xl rounded border border-stone-800 bg-stone-950"
          />
        </div>
        <div className="flex items-center gap-2 ml-4">
          {demoError && (
            <span className="text-xs text-red-400 max-w-48 truncate">{demoError}</span>
          )}
          {isDeviceConnected && (
            <button
              onClick={isDemoPlaying ? stopDemo : startDemo}
              disabled={actions.length === 0 && !isDemoPlaying}
              className={cn(
                'px-4 py-1.5 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                isDemoPlaying
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-stone-700 text-stone-200 hover:bg-stone-600',
              )}
            >
              {isDemoPlaying ? 'Stop Demo' : 'Demo'}
            </button>
          )}
          <button
            onClick={onExport}
            disabled={actions.length === 0}
            className="px-4 py-1.5 text-sm rounded-lg bg-amber-700 text-white hover:bg-amber-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export Script
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg border border-stone-700 text-stone-300 hover:bg-stone-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
