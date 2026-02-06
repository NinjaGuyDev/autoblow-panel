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
}

export function FunscriptLoader({
  funscriptFile,
  funscriptData,
  funscriptName,
  onFunscriptLoad,
  onFunscriptClear,
  error,
  isLoading,
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
        </div>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading funscript...</p>
      )}
    </div>
  );
}
