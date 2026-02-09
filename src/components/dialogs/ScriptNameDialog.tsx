import { useState, useEffect, useRef } from 'react';

interface ScriptNameDialogProps {
  isOpen: boolean;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

/**
 * Dialog for entering a name for a new script
 */
export function ScriptNameDialog({
  isOpen,
  onConfirm,
  onCancel,
}: ScriptNameDialogProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Reset name when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName) {
      onConfirm(trimmedName);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-stone-900 border border-stone-700 rounded-lg max-w-md w-full p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-stone-200 mb-4" style={{ fontFamily: 'var(--font-display)' }}>
          New Script
        </h2>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm text-stone-400 mb-2">
            Script Name
          </label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter script name..."
            className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded text-stone-200 placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-700/40"
            maxLength={50}
          />

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 px-4 py-2 rounded bg-amber-700 text-white hover:bg-amber-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Script
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded border border-stone-600 text-stone-300 hover:bg-stone-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
