import { FileDropzone } from './FileDropzone';

interface VideoLoaderProps {
  videoFile: File | null;
  videoUrl: string | null;
  videoName: string | null;
  onVideoLoad: (file: File) => void;
  onVideoClear: () => void;
  error: string | null;
}

export function VideoLoader({
  videoFile,
  videoUrl,
  videoName,
  onVideoLoad,
  onVideoClear,
  error,
}: VideoLoaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Video</h2>
        {videoFile && (
          <button
            onClick={onVideoClear}
            className="px-3 py-1 text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-md transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      {!videoFile ? (
        <FileDropzone
          onFileAccepted={onVideoLoad}
          accept={{ 'video/*': ['.mp4', '.webm', '.ogg', '.mkv'] }}
          label="Load Video"
          description="MP4, WebM, OGG, or MKV"
          error={error}
        />
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-muted/20 rounded-lg border border-muted">
            <p className="text-sm text-muted-foreground mb-1">Loaded:</p>
            <p className="font-medium">{videoName}</p>
          </div>

          {videoUrl && (
            <div className="rounded-lg overflow-hidden border border-muted">
              <video
                src={videoUrl}
                controls
                className="w-full"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
