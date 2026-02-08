import { useState, useEffect, useRef } from 'react';
import { libraryApi } from '@/lib/apiClient';
import type { ZodFunscript } from '@/lib/schemas';
import type { LibraryItem } from '@/../server/types/shared';

interface UseAutoSaveReturn {
  saveSession: (videoName: string | null, funscriptName: string | null, funscriptData: ZodFunscript | null) => Promise<void>;
  lastSession: LibraryItem | null;
  clearSession: () => Promise<void>;
}

/**
 * Auto-save hook that persists session data to SQLite backend
 *
 * Changes from previous IndexedDB version:
 * - Uses backend API instead of Dexie
 * - lastSession is now LibraryItem (id is number, lastModified is string)
 * - Debounces saves to avoid excessive API calls (2 second delay)
 * - Graceful error handling for API failures
 */
export function useAutoSave(): UseAutoSaveReturn {
  const [lastSession, setLastSession] = useState<LibraryItem | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  // Load the most recent session on mount
  useEffect(() => {
    const loadLastSession = async () => {
      try {
        const items = await libraryApi.getAll();
        if (items.length > 0) {
          // Get the most recent item (sorted by lastModified descending on backend)
          setLastSession(items[0]);
        }
      } catch (err) {
        console.error('Failed to load last session:', err);
      }
    };

    loadLastSession();
  }, []);

  const saveSession = async (
    videoName: string | null,
    funscriptName: string | null,
    funscriptData: ZodFunscript | null
  ) => {
    // Clear existing timeout
    if (saveTimeoutRef.current !== null) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce: save at most once per 2 seconds
    saveTimeoutRef.current = window.setTimeout(async () => {
      try {
        const saved = await libraryApi.save({
          videoName,
          funscriptName,
          funscriptData: funscriptData ? JSON.stringify(funscriptData) : '',
          duration: null, // Not tracked yet
        });
        setLastSession(saved);
      } catch (err) {
        console.error('Failed to save session:', err);
        // Don't crash the app on save failure
      }
    }, 2000);
  };

  const clearSession = async () => {
    if (lastSession) {
      try {
        await libraryApi.deleteItem(lastSession.id);
        setLastSession(null);
      } catch (err) {
        console.error('Failed to clear session:', err);
      }
    }
  };

  return {
    saveSession,
    lastSession,
    clearSession,
  };
}
