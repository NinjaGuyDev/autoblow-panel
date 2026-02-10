import { useState, useEffect, useRef, type RefObject } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';
import type { Funscript } from '@/types/funscript';
import type { SyncStatus, UseSyncPlaybackReturn } from '@/types/sync';
import { convertToSDKFunscript } from '@/lib/funscriptConverter';
import { getErrorMessage } from '@/lib/getErrorMessage';

// Drift detection constants (per 05-RESEARCH.md Pattern 4)
const DRIFT_CHECK_INTERVAL_MS = 2000; // Check every 2 seconds
const DRIFT_THRESHOLD_MS = 200; // Correct if > 200ms drift
const EMBED_DRIFT_THRESHOLD_MS = 500; // Higher threshold for embeds
const MAX_CORRECTION_MS = 500; // Safety cap on corrections

/**
 * Hook to orchestrate video-device synchronization
 *
 * Architecture (from 05-RESEARCH.md):
 * - Video element is master clock (single source of truth for timing)
 * - Device is follower that gets told when to start/stop/re-sync
 * - Upload funscript once on load (not on every seek)
 * - React to video events (play/pause/seeked) to drive SDK sync commands
 * - RAF-based drift detection loop (only during playback)
 * - Generation counter for race condition prevention
 * - Latency compensation on all syncScriptStart calls
 *
 * Anti-patterns avoided:
 * - Do NOT dispatch funscript actions client-side (SDK handles server-side)
 * - Do NOT re-upload funscript on every seek
 * - Do NOT use video timeupdate for drift detection (use RAF + getState)
 * - Do NOT run drift detection when paused
 * - Do NOT ignore latency compensation
 *
 * @param videoRef - Video element ref (from App.tsx)
 * @param ultra - SDK device instance (from useDeviceConnection)
 * @param funscriptData - Parsed funscript (from useFunscriptFile)
 * @param videoUrl - Current video URL (for re-attaching listeners when video changes)
 * @param embedOptions - Optional embed playback state for non-local videos
 */
export function useSyncPlayback(
  videoRef: RefObject<HTMLVideoElement | null>,
  ultra: Ultra | null,
  funscriptData: Funscript | null,
  videoUrl: string | null,
  embedOptions?: {
    isEmbed: boolean;
    currentTime: number;      // seconds, from useEmbedPlayback
    isPlaying: boolean;        // from useEmbedPlayback
    manualOffsetMs: number;    // from useManualSync
  }
): UseSyncPlaybackReturn {
  // State
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [scriptUploaded, setScriptUploaded] = useState(false);
  const [estimatedLatencyMs, setEstimatedLatencyMs] = useState(0);
  const [driftMs, setDriftMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Generation counter for command cancellation (race condition prevention)
  const generationRef = useRef(0);
  const driftLoopRef = useRef<number | null>(null);
  const lastDriftCheckRef = useRef<number>(0);

  // Internal functions for drift detection loop
  const stopDriftLoop = () => {
    if (driftLoopRef.current !== null) {
      cancelAnimationFrame(driftLoopRef.current);
      driftLoopRef.current = null;
    }
  };

  const startDriftLoop = () => {
    // Cancel any existing loop first
    stopDriftLoop();
    lastDriftCheckRef.current = 0;

    const checkDrift = async () => {
      const now = performance.now();

      // Only check every DRIFT_CHECK_INTERVAL_MS
      if (now - lastDriftCheckRef.current < DRIFT_CHECK_INTERVAL_MS) {
        driftLoopRef.current = requestAnimationFrame(checkDrift);
        return;
      }

      lastDriftCheckRef.current = now;

      if (!videoRef.current || !ultra) {
        driftLoopRef.current = requestAnimationFrame(checkDrift);
        return;
      }

      try {
        // Use getState() (network request) not getStateCache per research Pitfall 7
        const deviceState = await ultra.getState();
        const deviceTimeMs = deviceState.syncScriptCurrentTime;

        // Get video time - either from embed options or video element
        const videoTimeMs = embedOptions?.isEmbed
          ? embedOptions.currentTime * 1000
          : videoRef.current.currentTime * 1000;

        const drift = videoTimeMs - deviceTimeMs;

        // Update drift state for monitoring
        setDriftMs(drift);

        // Apply correction if drift exceeds threshold (higher threshold for embeds)
        const threshold = embedOptions?.isEmbed ? EMBED_DRIFT_THRESHOLD_MS : DRIFT_THRESHOLD_MS;
        if (Math.abs(drift) > threshold) {
          // Cap correction for safety
          const correction = Math.max(-MAX_CORRECTION_MS, Math.min(drift, MAX_CORRECTION_MS));
          await ultra.syncScriptOffset(correction);
        }
      } catch (err) {
        // Log errors but don't crash the loop (network errors are recoverable)
        console.error('Drift detection error:', err);
      }

      // Schedule next frame
      driftLoopRef.current = requestAnimationFrame(checkDrift);
    };

    // Start the loop
    driftLoopRef.current = requestAnimationFrame(checkDrift);
  };

  // Effect 1: Upload funscript when data + device available
  useEffect(() => {
    if (!ultra || !funscriptData) {
      setScriptUploaded(false);
      setSyncStatus('idle');
      stopDriftLoop();
      return;
    }

    const uploadFunscript = async () => {
      try {
        setSyncStatus('uploading');
        const sdkFunscript = convertToSDKFunscript(funscriptData);
        await ultra.syncScriptUploadFunscriptFile(sdkFunscript);
        setScriptUploaded(true);
        setSyncStatus('ready');
        setError(null);
      } catch (err) {
        console.error('Failed to upload funscript:', err);
        setSyncStatus('error');
        setError(getErrorMessage(err, 'Failed to upload funscript'));
        setScriptUploaded(false);
      }
    };

    uploadFunscript();

    // Cleanup: stop script on unmount or when data/device changes
    return () => {
      if (scriptUploaded && ultra) {
        ultra.syncScriptStop().catch(err => {
          console.error('Failed to stop sync script on cleanup:', err);
        });
      }
      stopDriftLoop();
    };
  }, [ultra, funscriptData]);

  // Effect 2: Estimate latency on device connection
  useEffect(() => {
    if (!ultra) return;

    ultra
      .estimateLatency()
      .then(latency => {
        setEstimatedLatencyMs(latency);
      })
      .catch(() => {
        // Latency estimation is best-effort; default 0ms is acceptable
      });
  }, [ultra]);

  // Effect 3: React to video play/pause/seeked/ended events (local video)
  useEffect(() => {
    // Skip event listeners for embed videos
    if (embedOptions?.isEmbed) return;

    const video = videoRef.current;
    if (!video || !ultra || !scriptUploaded) return;

    const handlePlay = async () => {
      // Increment generation to cancel any stale commands
      const generation = ++generationRef.current;

      try {
        const startTimeMs = Math.round(video.currentTime * 1000) + estimatedLatencyMs;
        await ultra.syncScriptStart(startTimeMs);

        // Check if stale
        if (generation !== generationRef.current) return;

        setSyncStatus('playing');
        startDriftLoop();
      } catch (err) {
        if (generation !== generationRef.current) return;
        console.error('Failed to start sync:', err);
        setSyncStatus('error');
        setError(getErrorMessage(err, 'Failed to start sync'));
      }
    };

    const handlePause = async () => {
      const generation = ++generationRef.current;

      try {
        await ultra.syncScriptStop();

        if (generation !== generationRef.current) return;

        setSyncStatus('paused');
        stopDriftLoop();
      } catch (err) {
        if (generation !== generationRef.current) return;
        console.error('Failed to pause sync:', err);
      }
    };

    const handleSeeked = async () => {
      // Only re-sync if playing (if paused, next play will start from correct position)
      if (!video.paused) {
        const generation = ++generationRef.current;

        try {
          const startTimeMs = Math.round(video.currentTime * 1000) + estimatedLatencyMs;
          await ultra.syncScriptStart(startTimeMs);

          if (generation !== generationRef.current) return;

          // Reset drift check to run immediately after seek
          lastDriftCheckRef.current = 0;
        } catch (err) {
          if (generation !== generationRef.current) return;
          console.error('Failed to re-sync after seek:', err);
        }
      }
    };

    const handleEnded = async () => {
      try {
        await ultra.syncScriptStop();
        setSyncStatus('ready');
        stopDriftLoop();
      } catch (err) {
        console.error('Failed to stop sync on video end:', err);
      }
    };

    // Attach all event listeners
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('ended', handleEnded);

    // Cleanup: remove all listeners and stop drift loop
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('ended', handleEnded);
      stopDriftLoop();
    };
  }, [ultra, scriptUploaded, estimatedLatencyMs, videoUrl, embedOptions?.isEmbed]); // videoUrl for re-attachment per existing pattern

  // Effect 3b: React to embed playback state changes
  useEffect(() => {
    // Only run for embeds
    if (!embedOptions?.isEmbed || !ultra || !scriptUploaded) return;

    const handleEmbedPlaybackChange = async () => {
      const generation = ++generationRef.current;

      if (embedOptions.isPlaying) {
        // Start sync
        try {
          const startTimeMs = Math.round(embedOptions.currentTime * 1000) + estimatedLatencyMs + (embedOptions.manualOffsetMs ?? 0);
          await ultra.syncScriptStart(startTimeMs);

          if (generation !== generationRef.current) return;

          setSyncStatus('playing');
          startDriftLoop();
        } catch (err) {
          if (generation !== generationRef.current) return;
          console.error('Failed to start embed sync:', err);
          setSyncStatus('error');
          setError(getErrorMessage(err, 'Failed to start sync'));
        }
      } else {
        // Stop sync
        try {
          await ultra.syncScriptStop();

          if (generation !== generationRef.current) return;

          setSyncStatus('paused');
          stopDriftLoop();
        } catch (err) {
          if (generation !== generationRef.current) return;
          console.error('Failed to pause embed sync:', err);
        }
      }
    };

    handleEmbedPlaybackChange();
  }, [embedOptions?.isEmbed, embedOptions?.isPlaying, ultra, scriptUploaded, estimatedLatencyMs]);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      stopDriftLoop();
      if (scriptUploaded && ultra) {
        ultra.syncScriptStop().catch(err => {
          console.error('Failed to stop sync script on unmount:', err);
        });
      }
    };
  }, []);

  return {
    syncStatus,
    scriptUploaded,
    estimatedLatencyMs,
    driftMs,
    error,
  };
}
