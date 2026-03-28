import { useState, useEffect } from 'react';

interface RandomizerToolbarProps {
  selectedCount: number;
  durationMinutes: number;
  onDurationChange: (minutes: number) => void;
  onGenerate: () => void;
  onCancel: () => void;
}

export function RandomizerToolbar({
  selectedCount,
  durationMinutes,
  onDurationChange,
  onGenerate,
  onCancel,
}: RandomizerToolbarProps) {
  const [durationInput, setDurationInput] = useState(() => String(durationMinutes));

  useEffect(() => {
    setDurationInput(String(durationMinutes));
  }, [durationMinutes]);

  const commitDuration = () => {
    const val = parseInt(durationInput);
    if (!isNaN(val) && val >= 1 && val <= 60) {
      onDurationChange(val);
    } else {
      setDurationInput(String(durationMinutes));
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-stone-900 border-t border-stone-700 px-6 py-3 flex items-center justify-between z-50">
      <div className="flex items-center gap-4">
        <span className="text-stone-300">
          <span className="text-amber-500 font-semibold">{selectedCount}</span> patterns selected
        </span>
        <div className="flex items-center gap-2">
          <label className="text-stone-400 text-sm">Duration:</label>
          <input
            type="number"
            min={1}
            max={60}
            value={durationInput}
            onChange={(e) => setDurationInput(e.target.value)}
            onBlur={commitDuration}
            onKeyDown={(e) => { if (e.key === 'Enter') commitDuration(); }}
            className="w-16 px-2 py-1 rounded bg-stone-800 border border-stone-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-700/40"
          />
          <span className="text-stone-400 text-sm">min</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded text-stone-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onGenerate}
          disabled={selectedCount < 2}
          className="px-4 py-2 rounded bg-amber-600 text-white font-medium hover:bg-amber-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Generate
        </button>
      </div>
    </div>
  );
}
