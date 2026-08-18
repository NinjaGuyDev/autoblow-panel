/**
 * Playback speed indicator for the Script Library.
 * Shows edge mode, the active mod, or the manual numpad factor, and nothing at
 * all when playback is running unmodified.
 */

import { Gauge, Hourglass, Wand2 } from 'lucide-react';
import type { ScriptMod } from '@server/types/shared';
import { formatSpeedFactor } from '@/lib/speedControlKeys';

interface SpeedBadgeProps {
  speedFactor: number;
  activeMod: ScriptMod | null;
  edgeModeActive: boolean;
  /** Mod held for the length of an edge program, resumed when it ends. */
  suspendedMod: ScriptMod | null;
  onClear: () => void;
}

export function SpeedBadge({
  speedFactor,
  activeMod,
  edgeModeActive,
  suspendedMod,
  onClear,
}: SpeedBadgeProps) {
  if (!edgeModeActive && !activeMod && speedFactor === 1) return null;

  const isFaster = speedFactor > 1;

  return (
    <button
      onClick={onClear}
      title={
        suspendedMod
          ? `Edge mode — ${suspendedMod.name} resumes when it ends. Click to return to original speed.`
          : 'Return to original speed'
      }
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        edgeModeActive
          ? 'bg-rose-700/30 text-rose-300 border border-rose-700/60 hover:bg-rose-700/50'
          : activeMod
          ? 'bg-violet-700/30 text-violet-300 border border-violet-700/60 hover:bg-violet-700/50'
          : isFaster
            ? 'bg-amber-700/30 text-amber-300 border border-amber-700/60 hover:bg-amber-700/50'
            : 'bg-sky-700/30 text-sky-300 border border-sky-700/60 hover:bg-sky-700/50'
      }`}
      style={{ fontFamily: 'var(--font-mono)' }}
    >
      {edgeModeActive ? (
        <>
          <Hourglass className="w-3 h-3" />
          <span>EDGE</span>
          {suspendedMod && (
            <span className="opacity-70 truncate max-w-[140px]">· {suspendedMod.name} held</span>
          )}
        </>
      ) : activeMod ? (
        <>
          <Wand2 className="w-3 h-3" />
          <span className="truncate max-w-[160px]">MOD: {activeMod.name}</span>
        </>
      ) : (
        <>
          <Gauge className="w-3 h-3" />
          <span>{formatSpeedFactor(speedFactor)}</span>
        </>
      )}
    </button>
  );
}
