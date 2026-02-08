import { useState, useEffect, useRef, RefObject } from 'react';
import { playlistApi, libraryApi } from '@/lib/apiClient';
import type { PlaylistItem } from '../../server/types/shared';
import type { Funscript } from '@/types/funscript';

interface UsePlaylistPlaybackProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  loadVideoFromUrl: (url: string, name: string) => void;
  loadFunscriptFromData: (name: string, data: Funscript) => void;
  clearVideo: () => void;
  clearFunscript: () => void;
}

interface UsePlaylistPlaybackReturn {
  // Playlist mode state
  isPlaylistMode: boolean;
  currentIndex: number;
  totalItems: number;
  currentItem: PlaylistItem | null;
  isLastItem: boolean;
  isFirstItem: boolean;

  // Controls
  startPlaylist: (playlistId: number) => Promise<void>;
  stopPlaylist: () => void;
  nextItem: () => void;
  previousItem: () => void;
  jumpToItem: (index: number) => void;

  // Preload state
  isPreloading: boolean;
}

/**
 * Hook to manage playlist playback state and sequential advancement
 *
 * Coordinates between playlist data and existing video/funscript/sync hooks.
 * Handles:
 * - Sequential playback with automatic advancement on video end
 * - Per-video funscript loading
 * - Next-video preloading for smooth transitions
 * - Navigation controls (next/previous/jump)
 *
 * Does NOT re-upload funscript manually - useSyncPlayback hook already
 * reacts to funscriptData changes and re-uploads automatically.
 */
export function usePlaylistPlayback({
  videoRef,
  loadVideoFromUrl,
  loadFunscriptFromData,
  clearVideo,
  clearFunscript,
}: UsePlaylistPlaybackProps): UsePlaylistPlaybackReturn {
  // Playlist state
  const [playlistId, setPlaylistId] = useState<number | null>(null);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPreloading, setIsPreloading] = useState(false);

  // Refs for managing preload and preventing stale closures
  const currentIndexRef = useRef(0);
  const transitioningRef = useRef(false);
  const preloadRef = useRef<HTMLVideoElement | null>(null);
  const preloadBlobUrlRef = useRef<string | null>(null);

  // Derived state
  const isPlaylistMode = playlistId !== null;
  const currentItem = items[currentIndex] ?? null;
  const totalItems = items.length;
  const isFirstItem = currentIndex === 0;
  const isLastItem = currentIndex === items.length - 1;

  // Keep ref in sync with state
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Load current item's video and funscript
  const loadCurrentItem = async (index: number) => {
    if (index < 0 || index >= items.length) return;

    transitioningRef.current = true;

    try {
      const item = items[index];

      // Fetch full library item to get funscriptData
      const libraryItem = await libraryApi.getById(item.libraryItemId);

      // Load video if available
      if (libraryItem.videoName) {
        const videoUrl = `/api/media/stream/${encodeURIComponent(libraryItem.videoName)}`;
        loadVideoFromUrl(videoUrl, libraryItem.videoName);
      } else {
        clearVideo();
      }

      // Parse and load funscript
      const parsedFunscript: Funscript = JSON.parse(libraryItem.funscriptData);
      loadFunscriptFromData(
        libraryItem.funscriptName || 'playlist-item.funscript',
        parsedFunscript
      );

      // Trigger preload of next item after loading completes
      preloadNextVideo(index);
    } catch (err) {
      console.error('Failed to load playlist item:', err);
    } finally {
      transitioningRef.current = false;
    }
  };

  // Preload next video using hidden element
  const preloadNextVideo = (currentIdx: number) => {
    const nextIdx = currentIdx + 1;
    if (nextIdx >= items.length) {
      setIsPreloading(false);
      return;
    }

    const nextItem = items[nextIdx];
    if (!nextItem?.videoName) {
      setIsPreloading(false);
      return;
    }

    setIsPreloading(true);

    // Clean up previous preload
    if (preloadBlobUrlRef.current) {
      URL.revokeObjectURL(preloadBlobUrlRef.current);
      preloadBlobUrlRef.current = null;
    }

    // Create preload element if needed
    if (!preloadRef.current) {
      preloadRef.current = document.createElement('video');
    }

    // Set up preload
    const videoUrl = `/api/media/stream/${encodeURIComponent(nextItem.videoName)}`;
    preloadRef.current.src = videoUrl;
    preloadRef.current.preload = 'auto';
    preloadRef.current.load();

    setIsPreloading(false);
  };

  // Start playlist playback
  const startPlaylist = async (id: number) => {
    try {
      const playlistItems = await playlistApi.getItems(id);

      if (playlistItems.length === 0) {
        throw new Error('Playlist is empty');
      }

      setPlaylistId(id);
      setItems(playlistItems);
      setCurrentIndex(0);
      await loadCurrentItem(0);
    } catch (err) {
      console.error('Failed to start playlist:', err);
      throw err;
    }
  };

  // Stop playlist playback
  const stopPlaylist = () => {
    setPlaylistId(null);
    setItems([]);
    setCurrentIndex(0);
    clearVideo();
    clearFunscript();

    // Clean up preload resources
    if (preloadBlobUrlRef.current) {
      URL.revokeObjectURL(preloadBlobUrlRef.current);
      preloadBlobUrlRef.current = null;
    }
    if (preloadRef.current) {
      preloadRef.current.src = '';
      preloadRef.current = null;
    }
  };

  // Navigate to next item
  const nextItem = () => {
    if (transitioningRef.current) return;
    if (currentIndex >= items.length - 1) return;

    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    loadCurrentItem(newIndex);
  };

  // Navigate to previous item
  const previousItem = () => {
    if (transitioningRef.current) return;
    if (currentIndex <= 0) return;

    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    loadCurrentItem(newIndex);
  };

  // Jump to specific item
  const jumpToItem = (index: number) => {
    if (transitioningRef.current) return;
    if (index < 0 || index >= items.length) return;

    setCurrentIndex(index);
    loadCurrentItem(index);
  };

  // Sequential advancement on video end
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPlaylistMode) return;

    const handleEnded = () => {
      // Avoid rapid advancement during transitions
      if (transitioningRef.current) return;

      const idx = currentIndexRef.current;

      // If last item, stop playlist
      if (idx >= items.length - 1) {
        stopPlaylist();
        return;
      }

      // Otherwise, advance to next item
      nextItem();
    };

    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoRef, isPlaylistMode, items.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (preloadBlobUrlRef.current) {
        URL.revokeObjectURL(preloadBlobUrlRef.current);
      }
      if (preloadRef.current) {
        preloadRef.current.src = '';
        preloadRef.current = null;
      }
    };
  }, []);

  return {
    isPlaylistMode,
    currentIndex,
    totalItems,
    currentItem,
    isLastItem,
    isFirstItem,
    startPlaylist,
    stopPlaylist,
    nextItem,
    previousItem,
    jumpToItem,
    isPreloading,
  };
}
