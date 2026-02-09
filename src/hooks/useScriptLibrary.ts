/**
 * Data fetching hook for script-only library items.
 * Mirrors useLibrary but filters to items where videoName is null
 * and funscriptName is not null (i.e. standalone scripts).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { libraryApi } from '@/lib/apiClient';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';
import type { LibraryItem } from '../../server/types/shared';

interface UseScriptLibraryReturn {
  scripts: LibraryItem[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  deleteItem: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

function isScriptOnly(item: LibraryItem): boolean {
  return item.videoName === null && item.funscriptName !== null;
}

export function useScriptLibrary(): UseScriptLibraryReturn {
  const [scripts, setScripts] = useState<LibraryItem[]>([]);
  const { loading, error, run, execute } = useAsyncOperation(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchItems = useCallback(async (query: string) => {
    try {
      const results = await run(
        () => query.trim() === '' ? libraryApi.getAll() : libraryApi.search(query),
        'Failed to fetch scripts',
      );
      setScripts(results.filter(isScriptOnly));
    } catch {
      setScripts([]);
    }
  }, [run]);

  // Debounced search
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      fetchItems(searchQuery);
    }, 300);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchQuery, fetchItems]);

  // Initial load
  useEffect(() => {
    fetchItems('');
  }, [fetchItems]);

  const deleteItem = async (id: number): Promise<void> => {
    await execute(
      () => libraryApi.deleteItem(id),
      'Failed to delete script',
    );
    await fetchItems(searchQuery);
  };

  const refresh = async (): Promise<void> => {
    await fetchItems(searchQuery);
  };

  return {
    scripts,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    deleteItem,
    refresh,
  };
}
