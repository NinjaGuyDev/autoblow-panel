import { RefreshCw, Scissors } from 'lucide-react';

interface TrimToFunscriptButtonProps {
  /** Where the trim aims to cut, in milliseconds; the real cut snaps to the keyframe before it */
  targetMs: number;
  isTrimming: boolean;
  error: string | null;
  onTrim: () => void;
}

function formatClock(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

/**
 * One-click "Trim to funscript": offered when the script starts well into the
 * video, it cuts the dead stretch off the front and loads the trimmed copy.
 */
export function TrimToFunscriptButton({ targetMs, isTrimming, error, onTrim }: TrimToFunscriptButtonProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onTrim}
        disabled={isTrimming}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 disabled:opacity-60 disabled:cursor-wait rounded-md transition-colors"
      >
        {isTrimming ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Scissors className="w-4 h-4" aria-hidden="true" />}
        {isTrimming ? 'Trimming…' : 'Trim to funscript'}
      </button>
      <span className="text-xs text-stone-500">
        The script starts late. Cuts up to {formatClock(targetMs)} off the start and saves a trimmed copy to the library.
      </span>
      {error && (
        <p role="alert" className="w-full text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
