const THUMBNAIL_WIDTH = 480;
const THUMBNAIL_QUALITY = 0.7;
const CAPTURE_TIME_SECONDS = 10;

/**
 * Capture a video frame at a given time and return as a JPEG Blob.
 * Uses an off-screen video element + canvas — no ffmpeg needed.
 */
export function captureVideoThumbnail(videoSrc: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    video.addEventListener('loadedmetadata', () => {
      // Seek to 10s or 10% of duration if video is shorter than 15s
      const seekTime = video.duration > 15
        ? CAPTURE_TIME_SECONDS
        : video.duration * 0.1;
      video.currentTime = seekTime;
    });

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        const aspectRatio = video.videoHeight / video.videoWidth;
        canvas.width = THUMBNAIL_WIDTH;
        canvas.height = Math.round(THUMBNAIL_WIDTH * aspectRatio);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          resolve(null);
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            cleanup();
            resolve(blob);
          },
          'image/jpeg',
          THUMBNAIL_QUALITY,
        );
      } catch {
        cleanup();
        resolve(null);
      }
    });

    video.addEventListener('error', () => {
      cleanup();
      resolve(null);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      cleanup();
      resolve(null);
    }, 10000);

    video.src = videoSrc;
  });
}
