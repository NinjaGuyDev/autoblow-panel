import type { TrainerPattern } from '@server/types/shared';
import { TRAINER_RANK_MAX, TRAINER_RANK_MIN } from '@server/types/shared';
import { formatRankSummary } from '@/lib/trainer/trainerPatternCard';
import { cn } from '@/lib/utils';

interface TrainerNowPlayingProps {
  pattern: TrainerPattern | null;
  pendingRank: number | null;
  passCount: number;
  onRank: (rank: number) => void;
}

const RANKS = Array.from({ length: TRAINER_RANK_MAX - TRAINER_RANK_MIN + 1 }, (_, i) => TRAINER_RANK_MIN + i);

/** The pattern on the device, its pass count, and the rank entered for it. */
export function TrainerNowPlaying({ pattern, pendingRank, passCount, onRank }: TrainerNowPlayingProps) {
  if (!pattern) {
    return (
      <div className="border border-stone-800 rounded-lg p-4 bg-stone-900/50 text-stone-500 text-sm">
        Press Start to begin. Each pattern loops until you rank it with the 0-9 keys
        (0 = least favorite, 9 = favorite); the next pattern starts when the current pass finishes.
      </div>
    );
  }

  return (
    <div className="border border-stone-800 rounded-lg p-4 bg-stone-900/50">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold text-stone-200" style={{ fontFamily: 'var(--font-display)' }}>
          {pattern.name}
        </h2>
        <span className="text-xs text-stone-500" style={{ fontFamily: 'var(--font-mono)' }}>
          pass {passCount} · {(pattern.durationMs / 1000).toFixed(1)}s · {formatRankSummary(pattern)}
        </span>
      </div>

      <div role="group" aria-label="Rank this pattern" className="flex flex-wrap gap-2">
        {RANKS.map(rank => (
          <button
            key={rank}
            onClick={() => onRank(rank)}
            aria-pressed={pendingRank === rank}
            className={cn(
              'w-10 h-10 rounded-lg font-medium transition-colors',
              pendingRank === rank
                ? 'bg-amber-600 text-white'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700',
            )}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {rank}
          </button>
        ))}
      </div>

      <p className="mt-3 text-sm text-stone-400" aria-live="polite">
        {pendingRank === null
          ? 'Looping until ranked — press 0-9.'
          : `Ranked ${pendingRank}. The next pattern starts when this pass finishes; press another number to change it.`}
      </p>
    </div>
  );
}
