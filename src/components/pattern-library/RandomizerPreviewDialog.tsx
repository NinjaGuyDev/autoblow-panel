import { useEffect, useRef, useState, useCallback } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';
import type { RandomizedScript } from '@/types/randomizer';
import { useRandomizerPlayback } from './useRandomizerPlayback';
import { useDeviceButtons } from '@/hooks/useDeviceButtons';
import { libraryApi } from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/getErrorMessage';

const CANVAS_HEIGHT = 200;

const SEGMENT_COLORS = [
  'rgba(59, 130, 246, 0.15)',
  'rgba(168, 85, 247, 0.15)',
  'rgba(236, 72, 153, 0.15)',
  'rgba(34, 197, 94, 0.15)',
  'rgba(234, 179, 8, 0.15)',
  'rgba(249, 115, 22, 0.15)',
  'rgba(20, 184, 166, 0.15)',
  'rgba(239, 68, 68, 0.15)',
];

interface RandomizerPreviewDialogProps {
  script: RandomizedScript;
  isOpen: boolean;
  onClose: () => void;
  onRegenerate: () => void;
  ultra: Ultra | null;
  isDeviceConnected: boolean;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function RandomizerPreviewDialog({
  script,
  isOpen,
  onClose,
  onRegenerate,
  ultra,
  isDeviceConnected,
}: RandomizerPreviewDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(800);
  const [saveName, setSaveName] = useState(
    `Randomized - ${new Date().toLocaleDateString('en-CA')}`
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const nullVideoRef = useRef<HTMLVideoElement>(null);

  const playback = useRandomizerPlayback(ultra, script);

  useDeviceButtons(ultra, nullVideoRef, false, playback.togglePause);

  // Resize observer for canvas width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setCanvasWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Draw timeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || script.actions.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const totalMs = script.totalDurationMs;

    ctx.clearRect(0, 0, w, h);

    // Draw segment backgrounds
    for (let i = 0; i < script.segments.length; i++) {
      const seg = script.segments[i];
      const x1 = (seg.startMs / totalMs) * w;
      const x2 = (seg.endMs / totalMs) * w;

      ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      ctx.fillRect(x1, 0, x2 - x1, h);

      // Draw pattern name in upper region (between 100% and 75% y-axis)
      const segWidth = x2 - x1;
      if (segWidth > 40) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '10px sans-serif';
        const textWidth = ctx.measureText(seg.patternName).width;
        if (textWidth <= segWidth - 8) {
          const textX = x1 + (segWidth - textWidth) / 2;
          const textY = h * 0.12;
          ctx.fillText(seg.patternName, textX, textY);
        }
      }
    }

    // Y-axis grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (const pct of [0.25, 0.5, 0.75]) {
      const y = pct * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Funscript line
    ctx.strokeStyle = '#c8956c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < script.actions.length; i++) {
      const action = script.actions[i];
      const x = (action.at / totalMs) * w;
      const y = h - (action.pos / 100) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Playback cursor
    if (playback.isPlaying || playback.isPaused) {
      const cursorX = (playback.currentTimeMs / totalMs) * w;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, h);
      ctx.stroke();
    }

    // PAUSED indicator
    if (playback.isPaused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(w / 2 - 40, h / 2 - 15, 80, 30);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', w / 2, h / 2 + 5);
      ctx.textAlign = 'start';
    }
  }, [script, canvasWidth, playback.currentTimeMs, playback.isPlaying, playback.isPaused]);

  // Stop demo on close
  useEffect(() => {
    if (!isOpen && playback.isPlaying) {
      playback.stopDemo();
    }
  }, [isOpen, playback.isPlaying, playback.stopDemo]);

  const handleSave = useCallback(async () => {
    if (!saveName.trim()) return;

    try {
      setIsSaving(true);
      setSaveError(null);

      await libraryApi.create({
        videoName: null,
        funscriptName: `${saveName.trim()}.funscript`,
        funscriptData: JSON.stringify({
          version: '1.0',
          inverted: false,
          range: 100,
          actions: script.actions,
        }),
        duration: script.totalDurationMs / 1000,
        isCustomPattern: 0,
        patternMetadata: JSON.stringify({ segments: script.segments }),
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Failed to save'));
    } finally {
      setIsSaving(false);
    }
  }, [saveName, script]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-stone-900 rounded-lg border border-stone-700 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-700">
          <div>
            <h2 className="text-xl font-semibold text-stone-200" style={{ fontFamily: 'var(--font-display)' }}>
              Randomized Script
            </h2>
            <p className="text-stone-400 text-sm mt-1">
              {formatTime(script.totalDurationMs)} · {script.segments.length} patterns
            </p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white text-2xl">&times;</button>
        </div>

        {/* Timeline */}
        <div className="px-6 py-4">
          <div ref={containerRef}>
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={CANVAS_HEIGHT}
              className="w-full h-auto rounded border border-stone-700 bg-stone-950"
            />
          </div>

          <div className="flex justify-between text-xs text-stone-500 mt-1">
            <span>{formatTime(playback.currentTimeMs)}</span>
            <span>{formatTime(script.totalDurationMs)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 pb-4 flex items-center gap-3">
          {playback.isPlaying ? (
            <>
              <button
                onClick={playback.togglePause}
                className="px-4 py-2 rounded bg-stone-700 text-white hover:bg-stone-600 transition-colors"
              >
                {playback.isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={playback.stopDemo}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-500 transition-colors"
              >
                Stop
              </button>
            </>
          ) : (
            <button
              onClick={playback.startDemo}
              disabled={!isDeviceConnected}
              className="px-4 py-2 rounded bg-amber-600 text-white font-medium hover:bg-amber-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {playback.isComplete ? 'Play Again' : 'Demo'}
            </button>
          )}
          <button
            onClick={onRegenerate}
            disabled={playback.isPlaying}
            className="px-4 py-2 rounded bg-stone-700 text-stone-300 hover:bg-stone-600 transition-colors disabled:opacity-40"
          >
            Regenerate
          </button>

          {playback.error && (
            <span className="text-red-400 text-sm">{playback.error}</span>
          )}
        </div>

        {/* Save section */}
        <div className="px-6 pb-6 border-t border-stone-700 pt-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="flex-1 px-3 py-2 rounded bg-stone-800 border border-stone-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-700/40"
              placeholder="Script name"
            />
            <button
              onClick={handleSave}
              disabled={isSaving || !saveName.trim()}
              className="px-4 py-2 rounded bg-amber-600 text-white font-medium hover:bg-amber-500 transition-colors disabled:opacity-40"
            >
              {saveSuccess ? 'Saved!' : isSaving ? 'Saving...' : 'Save to Library'}
            </button>
          </div>
          {saveError && (
            <p className="text-red-400 text-xs mt-2">{saveError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
