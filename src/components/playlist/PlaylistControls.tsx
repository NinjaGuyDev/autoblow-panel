import { X, SkipBack, SkipForward, ListMusic } from 'lucide-react';
import type { PlaylistItem } from '../../../server/types/shared';

interface PlaylistControlsProps {
  currentIndex: number;
  totalItems: number;
  currentItem: PlaylistItem | null;
  isFirstItem: boolean;
  isLastItem: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onStop: () => void;
}

/**
 * Compact control bar for playlist playback mode
 * Displays current position, navigation controls, and stop button
 */
export function PlaylistControls({
  currentIndex,
  totalItems,
  currentItem,
  isFirstItem,
  isLastItem,
  onPrevious,
  onNext,
  onStop,
}: PlaylistControlsProps) {
  const currentVideoName = currentItem?.videoName || currentItem?.funscriptName || 'Unknown';

  return (
    <div className="bg-card border border-border rounded-lg px-4 py-2 flex items-center justify-between gap-4 mb-4">
      {/* Left: Stop button */}
      <button
        onClick={onStop}
        className="hover:bg-muted rounded-md p-2 transition-colors"
        title="Stop playlist"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Center: Navigation controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={onPrevious}
          disabled={isFirstItem}
          className={`hover:bg-muted rounded-md p-2 transition-colors ${
            isFirstItem ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          title="Previous video"
        >
          <SkipBack className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 text-sm font-medium">
          <ListMusic className="h-4 w-4 text-muted-foreground" />
          <span>
            {currentIndex + 1} of {totalItems}
          </span>
        </div>

        <button
          onClick={onNext}
          disabled={isLastItem}
          className={`hover:bg-muted rounded-md p-2 transition-colors ${
            isLastItem ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          title="Next video"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>

      {/* Right: Current video name */}
      <div className="text-sm text-muted-foreground truncate max-w-xs">
        {currentVideoName}
      </div>
    </div>
  );
}
