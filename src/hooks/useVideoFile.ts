import { useState, useEffect } from 'react';

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

    const acceptedTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    if (!acceptedTypes.includes(file.type)) {
      setError(`Invalid file type. Accepted types: ${acceptedTypes.join(', ')}`);
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
