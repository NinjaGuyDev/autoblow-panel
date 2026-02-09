interface InsertPositionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (position: 'cursor' | 'end') => void;
}

/**
 * Simple dialog asking user to choose insertion position
 * Two options: at cursor position or at end
 */
export function InsertPositionDialog({
  isOpen,
  onClose,
  onInsert,
}: InsertPositionDialogProps) {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-stone-900 border border-stone-700 rounded-lg max-w-md w-full p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-stone-200 mb-4" style={{ fontFamily: 'var(--font-display)' }}>
          Where would you like to insert this pattern?
        </h2>

        <div className="space-y-3">
          <button
            onClick={() => onInsert('cursor')}
            className="w-full px-4 py-3 rounded border border-stone-800 bg-stone-950 hover:bg-stone-800/60 transition-colors text-left"
          >
            <div className="font-medium text-stone-200">At Cursor Position</div>
            <div className="text-sm text-stone-500 mt-1">
              Insert at current video time and shift existing actions
            </div>
          </button>

          <button
            onClick={() => onInsert('end')}
            className="w-full px-4 py-3 rounded border border-stone-800 bg-stone-950 hover:bg-stone-800/60 transition-colors text-left"
          >
            <div className="font-medium text-stone-200">At End</div>
            <div className="text-sm text-stone-500 mt-1">
              Append pattern after the last action
            </div>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 text-sm text-stone-500 hover:text-stone-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
