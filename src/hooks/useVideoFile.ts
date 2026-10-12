import { useState, useEffect } from 'react';
import { ACCEPTED_VIDEO_EXTENSIONS, isAcceptedVideoFile } from '@/lib/videoFileTypes';

interface UseVideoFileReturn {
  videoFile: File | null;
  videoUrl: string | null;
  videoName: string | null;
  loadVideo: (file: File) => void;
  loadVideoFromUrl: (url: string, name: string) => void;
  clearVideo: () => void;
  error: string | null;
}

export function useVideoFile(): UseVideoFileReturn {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string | null>(null);
  const [isBlobUrl, setIsBlobUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revokeIfBlob = (url: string | null) => {
    if (url && isBlobUrl) {
      URL.revokeObjectURL(url);
    }
  };

  const loadVideo = (file: File) => {
    setError(null);

    if (!isAcceptedVideoFile(file)) {
      setError(`Invalid file type. Accepted types: ${ACCEPTED_VIDEO_EXTENSIONS.join(', ')}`);
      return;
    }

    revokeIfBlob(videoUrl);

    const blobUrl = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(blobUrl);
    setVideoName(file.name);
    setIsBlobUrl(true);
  };

  const loadVideoFromUrl = (url: string, name: string) => {
    setError(null);
    revokeIfBlob(videoUrl);

    setVideoFile(null);
    setVideoUrl(url);
    setVideoName(name);
    setIsBlobUrl(false);
  };

  const clearVideo = () => {
    revokeIfBlob(videoUrl);
    setVideoFile(null);
    setVideoUrl(null);
    setVideoName(null);
    setIsBlobUrl(false);
    setError(null);
  };

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (videoUrl && isBlobUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl, isBlobUrl]);

  return {
    videoFile,
    videoUrl,
    videoName,
    loadVideo,
    loadVideoFromUrl,
    clearVideo,
    error,
  };
}
