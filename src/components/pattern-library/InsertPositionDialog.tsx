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
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-card border border-muted rounded-lg max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Where would you like to insert this pattern?
        </h2>

        <div className="space-y-3">
          <button
            onClick={() => onInsert('cursor')}
            className="w-full px-4 py-3 rounded border border-muted bg-background hover:bg-muted/50 transition-colors text-left"
          >
            <div className="font-medium text-foreground">At Cursor Position</div>
            <div className="text-sm text-muted-foreground mt-1">
              Insert at current video time and shift existing actions
            </div>
          </button>

          <button
            onClick={() => onInsert('end')}
            className="w-full px-4 py-3 rounded border border-muted bg-background hover:bg-muted/50 transition-colors text-left"
          >
            <div className="font-medium text-foreground">At End</div>
            <div className="text-sm text-muted-foreground mt-1">
              Append pattern after the last action
            </div>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
