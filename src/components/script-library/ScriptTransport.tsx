import type { ClimaxRecord } from '@server/types/shared';
import { useClimaxMarkers } from '@/hooks/useClimaxMarkers';
import { useSeekController } from '@/hooks/useSeekController';
import { useTransportKeys } from '@/hooks/useTransportKeys';
import { nextMarker, previousMarker } from '@/lib/climaxMarkers';
import { SeekDirection } from '@/lib/transportKeys';
import { ScriptTransportBar } from '@/components/script-library/ScriptTransportBar';

interface ScriptTransportProps {
  libraryItemId: number;
  title: string;
  isPaused: boolean;
  isDeviceConnected: boolean;
  currentTimeMs: number;
  durationMs: number;
  /** Bump to reload climax markers after records change. */
  climaxRevision: number;
  fetchClimaxRecords: (libraryItemId: number) => Promise<ClimaxRecord[]>;
  onTogglePause: () => Promise<void>;
  onSeek: (timeMs: number) => Promise<void>;
  onStop: () => Promise<void>;
}

/**
 * Wires the transport bar to pending-seek state, climax markers and keyboard
 * shortcuts. Mount it keyed by script id so a pending seek never carries into
 * the next script.
 */
export function ScriptTransport({
  libraryItemId,
  title,
  isPaused,
  isDeviceConnected,
  currentTimeMs,
  durationMs,
  climaxRevision,
  fetchClimaxRecords,
  onTogglePause,
  onSeek,
  onStop,
}: ScriptTransportProps) {
  const seek = useSeekController({ currentTimeMs, durationMs, onSeek });
  const climaxMarkersMs = useClimaxMarkers({
    libraryItemId,
    revision: climaxRevision,
    fetchRecords: fetchClimaxRecords,
  });

  const previousClimax = previousMarker(climaxMarkersMs, seek.displayTimeMs);
  const nextClimax = nextMarker(climaxMarkersMs, seek.displayTimeMs);

  const jumpToClimax = (direction: SeekDirection) => {
    const target = direction === SeekDirection.Back ? previousClimax : nextClimax;
    if (target !== null) seek.jumpTo(target);
  };

  const togglePause = () => {
    onTogglePause().catch(err => console.error('Pause/resume failed:', err));
  };

  const stop = () => {
    onStop().catch(err => console.error('Failed to stop playback:', err));
  };

  useTransportKeys({
    enabled: isDeviceConnected,
    onTogglePause: togglePause,
    onSkip: seek.skip,
    onClimaxJump: jumpToClimax,
  });

  return (
    <ScriptTransportBar
      title={title}
      isPaused={isPaused}
      disabled={!isDeviceConnected}
      displayTimeMs={seek.displayTimeMs}
      durationMs={durationMs}
      onTogglePause={togglePause}
      onSkip={seek.skip}
      onScrub={seek.scrubTo}
      onCommitScrub={seek.commitScrub}
      onStop={stop}
      climaxMarkersMs={climaxMarkersMs}
      hasPreviousClimax={previousClimax !== null}
      hasNextClimax={nextClimax !== null}
      onClimaxJump={jumpToClimax}
      onJumpTo={seek.jumpTo}
    />
  );
}
