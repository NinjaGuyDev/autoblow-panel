import { useEffect, useRef, useState } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';

const EVENTSOURCE_RECONNECT_INTERVAL_MS = 90_000;

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
  const [eventSourceGeneration, setEventSourceGeneration] = useState(0);

  useEffect(() => {
    onScriptPauseRef.current = onScriptPause;
  }, [onScriptPause]);

  // Proactively reconnect the SSE EventSource every 90s to prevent
  // browser idle timeout (~120s) from silently killing the connection.
  useEffect(() => {
    if (!ultra) return;

    const intervalId = setInterval(() => {
      const stale = ultra.deviceEvents;
      ultra.deviceEvents = ultra.subscribeToEvents();
      stale.close();
      setEventSourceGeneration((g) => g + 1);
    }, EVENTSOURCE_RECONNECT_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [ultra]);

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

    const currentEventSource = ultra.deviceEvents;
    currentEventSource.addEventListener('pause-button-pressed', handlePauseButton);

    return () => {
      currentEventSource.removeEventListener('pause-button-pressed', handlePauseButton);
    };
  }, [ultra, videoRef, isEmbed, eventSourceGeneration]);
}
