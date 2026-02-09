import { useEffect } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';

/**
 * Listens for physical button presses on the Autoblow Ultra device
 * and maps them to application actions.
 *
 * Currently handles the pause button — toggles play/pause on the
 * local video element. Does nothing when no device is connected
 * or when an embedded video is active (embeds lack direct element control).
 */
export function useDeviceButtons(
  ultra: Ultra | null,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  isEmbed: boolean,
) {
  useEffect(() => {
    if (!ultra || isEmbed) return;

    const handlePauseButton = () => {
      const video = videoRef.current;
      if (!video) return;

      if (video.paused) {
        video.play().catch(() => {
          // Browser may block autoplay — ignore silently
        });
      } else {
        video.pause();
      }
    };

    ultra.deviceEvents.addEventListener('pause-button-pressed', handlePauseButton);

    return () => {
      ultra.deviceEvents.removeEventListener('pause-button-pressed', handlePauseButton);
    };
  }, [ultra, videoRef, isEmbed]);
}
