interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

/**
 * Seekable progress bar using native range input
 * Provides keyboard support, touch support, and accessibility out of the box
 */
export function ProgressBar({ currentTime, duration, onSeek }: ProgressBarProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    onSeek(newTime);
  };

  return (
    <div className="flex-1 px-2">
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={currentTime}
        onChange={handleChange}
        aria-label="Video progress"
        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary hover:accent-primary/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
      />
    </div>
  );
}
