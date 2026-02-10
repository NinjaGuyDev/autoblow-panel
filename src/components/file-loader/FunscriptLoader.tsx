import { FileDropzone } from './FileDropzone';
import type { Funscript, FunscriptMetadata } from '@/types/funscript';

interface FunscriptLoaderProps {
  funscriptFile: File | null;
  funscriptData: Funscript | null;
  funscriptName: string | null;
  onFunscriptLoad: (file: File) => void;
  onFunscriptClear: () => void;
  error: string | null;
  isLoading: boolean;
  showTimeline: boolean;
  onToggleTimeline: () => void;
}

export function FunscriptLoader({
  funscriptFile,
  funscriptData,
  funscriptName,
  onFunscriptLoad,
  onFunscriptClear,
  error,
  isLoading,
  showTimeline,
  onToggleTimeline,
}: FunscriptLoaderProps) {
  // Type guard to check if funscript has metadata
  const metadata: FunscriptMetadata | null =
    funscriptData && 'metadata' in funscriptData && funscriptData.metadata
      ? (funscriptData.metadata as FunscriptMetadata)
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Funscript</h2>
        {funscriptFile && (
          <button
            onClick={onFunscriptClear}
            className="px-3 py-1 text-sm bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 rounded-md transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      {!funscriptFile ? (
        <FileDropzone
          onFileAccepted={onFunscriptLoad}
          accept={{ 'application/json': ['.funscript', '.json'] }}
          label="Load Funscript"
          description=".funscript or .json files"
          error={error}
          disabled={isLoading}
        />
      ) : (
        <div className="p-4 bg-stone-800/20 rounded-lg border border-stone-800 space-y-2">
          <div>
            <p className="text-sm text-stone-500 mb-1">Loaded:</p>
            <p className="font-medium">
              {metadata?.title ?? funscriptName}
            </p>
          </div>

          {/* Timeline visibility toggle */}
          {funscriptData && (
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTimeline}
                  onChange={onToggleTimeline}
                  className="w-4 h-4 rounded border-stone-800 text-amber-700 focus:ring-2 focus:ring-amber-700/40 focus:ring-offset-2 focus:ring-offset-stone-900 cursor-pointer"
                />
                <span className="text-sm text-stone-500">
                  Show Timeline (disable to improve performance)
                </span>
              </label>
            </div>
          )}

          {funscriptData && (
            <div className="pt-2 border-t border-stone-800 space-y-1">
              <p className="text-sm text-stone-500">
                <span style={{ fontFamily: 'var(--font-mono)' }}>{funscriptData.actions.length}</span> actions
              </p>
              {metadata && (
                <>
                  {metadata.performers && metadata.performers.length > 0 && (
                    <p className="text-sm text-stone-500">
                      Performers: {metadata.performers.join(', ')}
                    </p>
                  )}
                  {metadata.duration && (
                    <p className="text-sm text-stone-500">
                      Duration: <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.floor(metadata.duration / 1000)}s</span>
                    </p>
                  )}
                  {metadata.tags && metadata.tags.length > 0 && (
                    <p className="text-sm text-stone-500">
                      Tags: {metadata.tags.join(', ')}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <p className="text-sm text-stone-500">Loading funscript...</p>
      )}
    </div>
  );
}
