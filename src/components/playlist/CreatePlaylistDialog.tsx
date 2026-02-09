import { useState, useEffect, useRef } from 'react';

interface CreatePlaylistDialogProps {
  isOpen: boolean;
  onConfirm: (name: string, description?: string) => void;
  onCancel: () => void;
}

/**
 * Dialog for creating a new playlist with name and optional description
 */
export function CreatePlaylistDialog({
  isOpen,
  onConfirm,
  onCancel,
}: CreatePlaylistDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus name input when dialog opens
  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isOpen]);

  // Reset fields when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (trimmedName) {
      onConfirm(trimmedName, trimmedDescription || undefined);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-stone-900 border border-stone-700 rounded-lg max-w-md w-full p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-stone-200 mb-4" style={{ fontFamily: 'var(--font-display)' }}>
          Create New Playlist
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm text-stone-400 mb-2">
              Playlist Name <span className="text-orange-400">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter playlist name..."
              className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded text-stone-200 placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-700/40"
              maxLength={100}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm text-stone-400 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this playlist..."
              rows={3}
              className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded text-stone-200 placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-700/40 resize-none"
              maxLength={500}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 px-4 py-2 rounded bg-amber-700 text-white hover:bg-amber-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Playlist
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
