import { useState } from 'react';
import { useDevice } from '@/contexts/DeviceContext';
import { useTrainerPatterns } from '@/hooks/useTrainerPatterns';
import { useTrainerSession } from '@/hooks/useTrainerSession';
import { useRankKeys } from '@/hooks/useRankKeys';
import { Timeline } from '@/components/timeline/Timeline';
import { TrainerNowPlaying } from '@/components/trainer/TrainerNowPlaying';
import { TrainerPatternGrid, type TrainerSortOrder } from '@/components/trainer/TrainerPatternGrid';

const TIMELINE_PLACEHOLDER_HEIGHT = 180;

/**
 * Trainer page — plays trainer patterns one at a time so the user can rank
 * them, building up an average rank per pattern.
 */
export function TrainerPage() {
  const { ultra, isDeviceConnected } = useDevice();
  const { patterns, loading, error: patternsError, recordRank } = useTrainerPatterns();
  const session = useTrainerSession({ ultra, patterns, recordRank });
  const [sortOrder, setSortOrder] = useState<TrainerSortOrder>('family');

  const isActive = session.status !== 'idle';
  useRankKeys(session.status === 'playing', session.rank);

  // Show live stats: the session holds a snapshot taken when the pattern started
  const currentPattern = session.currentPattern
    ? patterns.find(p => p.id === session.currentPattern!.id) ?? session.currentPattern
    : null;
  const error = session.error ?? patternsError;

  return (
    <div
      role="tabpanel"
      id="panel-trainer"
      aria-labelledby="tab-trainer"
      className="container mx-auto px-4 py-6 space-y-6"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-200" style={{ fontFamily: 'var(--font-display)' }}>
          Trainer
        </h1>
        <button
          onClick={isActive ? session.stop : session.start}
          disabled={!isActive && (!isDeviceConnected || patterns.length === 0)}
          className={`px-4 py-2 rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isActive ? 'bg-stone-800 text-stone-200 hover:bg-stone-700' : 'bg-amber-700 text-white hover:bg-amber-600'
          }`}
        >
          {isActive ? 'Stop' : 'Start Training'}
        </button>
      </div>

      {!isDeviceConnected && (
        <p className="text-sm text-stone-500">Connect your device to start training.</p>
      )}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      <TrainerNowPlaying
        pattern={currentPattern}
        pendingRank={session.pendingRank}
        passCount={session.passCount}
        onRank={session.rank}
      />

      {session.loopActions.length > 0 ? (
        <Timeline
          actions={session.loopActions}
          currentTimeMs={session.currentTimeMs}
          durationMs={session.loopDurationMs}
          isPlaying={session.status === 'playing'}
          onSeek={timeSeconds => void session.seek(timeSeconds * 1000)}
        />
      ) : (
        <div
          className="bg-stone-900/50 border border-stone-800 rounded-lg flex items-center justify-center text-stone-500 text-sm"
          style={{ height: TIMELINE_PLACEHOLDER_HEIGHT }}
        >
          The playing pattern appears here
        </div>
      )}

      <section aria-labelledby="trainer-patterns-heading">
        <div className="flex items-center justify-between mb-4">
          <h2 id="trainer-patterns-heading" className="text-sm text-stone-500">
            {loading ? 'Loading patterns…' : `${patterns.length} trainer patterns`}
          </h2>
          <label className="flex items-center gap-2 text-sm text-stone-400">
            Sort by
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as TrainerSortOrder)}
              className="px-2 py-1 rounded bg-stone-800 border border-stone-700 text-stone-200"
            >
              <option value="family">Pattern family</option>
              <option value="rank">Average rank</option>
            </select>
          </label>
        </div>

        {!loading && patterns.length === 0 ? (
          <p className="text-stone-500 text-sm">
            No trainer patterns yet. Extract some with{' '}
            <code className="text-stone-300">npx tsx server/scripts/extract-trainer-patterns.ts &lt;file.funscript&gt;…</code>
          </p>
        ) : (
          <TrainerPatternGrid
            patterns={patterns}
            currentPatternId={currentPattern?.id ?? null}
            sortOrder={sortOrder}
          />
        )}
      </section>
    </div>
  );
}
