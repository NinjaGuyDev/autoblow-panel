import { useState, useEffect } from 'react';

interface UseVideoFileReturn {
  videoFile: File | null;
  videoUrl: string | null;
  videoName: string | null;
  loadVideo: (file: File) => void;
  clearVideo: () => void;
  error: string | null;
}

export function useVideoFile(): UseVideoFileReturn {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadVideo = (file: File) => {
    setError(null);

    // Validate file type
    const acceptedTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    if (!acceptedTypes.includes(file.type)) {
      setError(`Invalid file type. Accepted types: ${acceptedTypes.join(', ')}`);
      return;
    }

    // Revoke previous blob URL if exists to prevent memory leak
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    // Create new blob URL
    const blobUrl = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(blobUrl);
  };

  const clearVideo = () => {
    // Revoke blob URL to free memory
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoFile(null);
    setVideoUrl(null);
    setError(null);
  };

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const videoName = videoFile?.name ?? null;

  return {
    videoFile,
    videoUrl,
    videoName,
    loadVideo,
    clearVideo,
    error,
  };
}
