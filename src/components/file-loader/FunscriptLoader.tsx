import { FileDropzone } from './FileDropzone';
import type { ZodFunscript } from '@/lib/schemas';

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
            <p className="font-medium">{funscriptName}</p>
          </div>
          {funscriptData && (
            <div className="pt-2 border-t border-muted">
              <p className="text-sm text-muted-foreground">
                {funscriptData.actions.length} actions
              </p>
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
