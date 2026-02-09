import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PatternDialogShellProps {
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  saveError: string | null;
  isDemoPlaying: boolean;
  demoError: string | null;
  isDeviceConnected: boolean;
  onStartDemo: () => void;
  onStopDemo: () => void;
  header: ReactNode;
  children: ReactNode;
}

/**
 * Shared modal shell for pattern editor dialogs.
 * Provides backdrop, close button, error display, and action row (Demo / Save / Close).
 * Callers handle their own visibility — this component always renders when mounted.
 */
export function PatternDialogShell({
  onClose,
  onSave,
  isSaving,
  saveError,
  isDemoPlaying,
  demoError,
  isDeviceConnected,
  onStartDemo,
  onStopDemo,
  header,
  children,
}: PatternDialogShellProps) {
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
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header row: caller-provided content + close button */}
        <div className="flex items-start justify-between mb-4 gap-4">
          <div className="flex-1 min-w-0">{header}</div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Main content */}
        {children}

        {/* Error messages */}
        {demoError && (
          <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            {demoError}
          </div>
        )}
        {saveError && (
          <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            {saveError}
          </div>
        )}

        {/* Action row */}
        <div className="flex gap-3">
          {isDeviceConnected && (
            <button
              onClick={isDemoPlaying ? onStopDemo : onStartDemo}
              className={cn(
                'px-4 py-2 rounded font-medium shadow-sm transition-colors',
                isDemoPlaying
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-purple-600 text-white hover:bg-purple-700',
              )}
            >
              {isDemoPlaying ? 'Stop Demo' : 'Demo'}
            </button>
          )}

          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex-1 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-zinc-600 text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
