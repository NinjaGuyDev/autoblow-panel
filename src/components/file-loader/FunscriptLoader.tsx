import { FileDropzone } from './FileDropzone';
import type { ZodFunscript } from '@/lib/schemas';
import type { FunscriptMetadata } from '@/types/funscript';

interface FunscriptLoaderProps {
  funscriptFile: File | null;
  funscriptData: ZodFunscript | null;
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
        <h2 className="text-xl font-semibold">Funscript</h2>
        {funscriptFile && (
          <button
            onClick={onFunscriptClear}
            className="px-3 py-1 text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-md transition-colors"
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
        <div className="p-4 bg-muted/20 rounded-lg border border-muted space-y-2">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Loaded:</p>
            <p className="font-medium">
              {metadata?.title ?? funscriptName}
            </p>
          </div>
          {funscriptData && (
            <div className="pt-2 border-t border-muted space-y-1">
              <p className="text-sm text-muted-foreground">
                {funscriptData.actions.length} actions
              </p>
              {metadata && (
                <>
                  {metadata.performers && metadata.performers.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Performers: {metadata.performers.join(', ')}
                    </p>
                  )}
                  {metadata.duration && (
                    <p className="text-sm text-muted-foreground">
                      Duration: {Math.floor(metadata.duration / 1000)}s
                    </p>
                  )}
                  {metadata.tags && metadata.tags.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Tags: {metadata.tags.join(', ')}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Timeline visibility toggle */}
          {funscriptData && (
            <div className="pt-3 border-t border-muted mt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTimeline}
                  onChange={onToggleTimeline}
                  className="w-4 h-4 rounded border-muted text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background cursor-pointer"
                />
                <span className="text-sm text-muted-foreground">
                  Show Timeline (disable to improve performance)
                </span>
              </label>
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading funscript...</p>
      )}
    </div>
  );
}
