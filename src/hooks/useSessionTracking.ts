import { useState, useEffect } from 'react';
import { sessionApi } from '@/lib/apiClient';

interface UseSessionTrackingParams {
  isPlaying: boolean;
  playbackContext: 'normal' | 'demo' | 'manual';
  currentLibraryItemId: number | null;
}

interface UseSessionTrackingResult {
  trackingPreference: boolean | null;
  showOverlay: boolean;
  currentSessionId: number | null;
  handleAccept: () => void;
  handleDecline: () => void;
}

/**
 * useSessionTracking hook
 * Manages session tracking opt-in state, localStorage persistence, and session lifecycle
 *
 * Behavior:
 * - Lazy-loads tracking preference from localStorage on mount
 * - Shows opt-in overlay when normal playback starts and preference is undecided
 * - Creates sessions only for normal context when user has opted in
 * - Ends sessions when playback stops
 * - Handles beforeunload cleanup for orphaned session prevention
 */
export function useSessionTracking({
  isPlaying,
  playbackContext,
  currentLibraryItemId,
}: UseSessionTrackingParams): UseSessionTrackingResult {
  // Lazy init from localStorage (null = undecided, true = opted in, false = declined)
  const [trackingPreference, setTrackingPreference] = useState<boolean | null>(() => {
    const stored = localStorage.getItem('session-tracking-enabled');
    return stored !== null ? stored === 'true' : null;
  });

  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [pendingCreation, setPendingCreation] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  // Show overlay when normal playback starts and preference is undecided
  useEffect(() => {
    if (isPlaying && trackingPreference === null && playbackContext === 'normal') {
      setShowOverlay(true);
    } else {
      setShowOverlay(false);
    }
  }, [isPlaying, trackingPreference, playbackContext]);

  // Create session when opted in and normal playback starts
  useEffect(() => {
    if (
      isPlaying &&
      trackingPreference === true &&
      playbackContext === 'normal' &&
      currentSessionId === null &&
      !pendingCreation
    ) {
      setPendingCreation(true);

      sessionApi
        .create({
          startedAt: new Date().toISOString(),
          libraryItemId: currentLibraryItemId,
          context: 'normal',
        })
        .then((session) => {
          setCurrentSessionId(session.id);
          setPendingCreation(false);
        })
        .catch((err) => {
          console.error('Failed to create session:', err);
          setPendingCreation(false);
        });
    }
  }, [isPlaying, trackingPreference, playbackContext, currentSessionId, pendingCreation, currentLibraryItemId]);

  // End session when playback stops
  useEffect(() => {
    if (!isPlaying && currentSessionId !== null) {
      sessionApi
        .end(currentSessionId)
        .catch((err) => {
          console.error('Failed to end session:', err);
        })
        .finally(() => {
          setCurrentSessionId(null);
        });
    }
  }, [isPlaying, currentSessionId]);

  // Append script when library item changes during active session
  useEffect(() => {
    if (currentSessionId !== null && currentLibraryItemId !== null) {
      sessionApi
        .appendScript(currentSessionId, currentLibraryItemId)
        .catch((err) => {
          console.error('Failed to append script to session:', err);
        });
    }
  }, [currentSessionId, currentLibraryItemId]);

  // beforeunload cleanup for orphaned session prevention
  useEffect(() => {
    if (currentSessionId === null) return;

    const handleBeforeUnload = () => {
      // Use keepalive fetch to ensure request completes after page unload
      fetch(`/api/sessions/${currentSessionId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endedAt: new Date().toISOString() }),
        keepalive: true,
      }).catch((err) => {
        console.error('Failed to end session on beforeunload:', err);
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentSessionId]);

  // Accept handler
  const handleAccept = () => {
    setTrackingPreference(true);
    localStorage.setItem('session-tracking-enabled', 'true');
    setShowOverlay(false);
  };

  // Decline handler
  const handleDecline = () => {
    setTrackingPreference(false);
    localStorage.setItem('session-tracking-enabled', 'false');
    setShowOverlay(false);
  };

  return {
    trackingPreference,
    showOverlay,
    currentSessionId,
    handleAccept,
    handleDecline,
  };
}
