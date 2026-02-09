import { useEffect, useRef } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';

/**
 * Listens for physical button presses on the Autoblow Ultra device
 * and maps them to application actions.
 *
 * Handles the pause button:
 * - If script playback is active, toggles script pause/resume
 * - Otherwise, toggles play/pause on the local video element
 * - Does nothing for embedded videos (embeds lack direct element control)
 */
export function useDeviceButtons(
  ultra: Ultra | null,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  isEmbed: boolean,
  onScriptPause?: () => void,
) {
  const onScriptPauseRef = useRef(onScriptPause);

  useEffect(() => {
    onScriptPauseRef.current = onScriptPause;
  }, [onScriptPause]);

  useEffect(() => {
    if (!ultra) return;

    const handlePauseButton = () => {
      // Script playback takes priority
      if (onScriptPauseRef.current) {
        onScriptPauseRef.current();
        return;
      }

      // Fall back to video toggle
      if (isEmbed) return;

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
