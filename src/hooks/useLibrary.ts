/**
 * Library data hook for fetching, searching, and managing library items
 * Provides client-side filtering and debounced search
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { libraryApi } from '@/lib/apiClient';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';
import type { LibraryItem } from '../../server/types/shared';

export type LibraryFilter = 'all' | 'has-video' | 'has-funscript';

interface UseLibraryReturn {
  items: LibraryItem[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filter: LibraryFilter;
  setFilter: (f: LibraryFilter) => void;
  deleteItem: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing library data with search and filter capabilities
 */
export function useLibrary(): UseLibraryReturn {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const { loading, error, run, execute } = useAsyncOperation(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [rawItems, setRawItems] = useState<LibraryItem[]>([]);

  // Debounce timeout ref
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch library items (all or search results)
   */
  const fetchItems = useCallback(async (query: string) => {
    try {
      const results = await run(
        () => query.trim() === '' ? libraryApi.getAll() : libraryApi.search(query),
        'Failed to fetch library items',
      );
      setRawItems(results);
    } catch {
      setRawItems([]);
    }
  }, [run]);

  /**
   * Apply client-side filter to raw items
   */
  const applyFilter = useCallback((itemsToFilter: LibraryItem[], currentFilter: LibraryFilter): LibraryItem[] => {
    // Exclude script-only items (no video) from the main Library — those live in Script Library
    const withVideo = itemsToFilter.filter(item => item.videoName !== null);

    switch (currentFilter) {
      case 'has-video':
        return withVideo;
      case 'has-funscript':
        return withVideo.filter(item => item.funscriptName !== null);
      case 'all':
      default:
        return withVideo;
    }
  }, []);

  /**
   * Update filtered items when raw items or filter changes
   */
  useEffect(() => {
    const filtered = applyFilter(rawItems, filter);
    setItems(filtered);
  }, [rawItems, filter, applyFilter]);

  /**
   * Debounced search effect
   */
  useEffect(() => {
    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for debounced search (300ms)
    debounceTimeoutRef.current = setTimeout(() => {
      fetchItems(searchQuery);
    }, 300);

    // Cleanup
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchQuery, fetchItems]);

  /**
   * Initial load on mount
   */
  useEffect(() => {
    fetchItems('');
  }, [fetchItems]);

  /**
   * Delete item and refresh list
   */
  const deleteItem = async (id: number): Promise<void> => {
    await execute(
      () => libraryApi.deleteItem(id),
      'Failed to delete item',
    );
    await fetchItems(searchQuery);
  };

  /**
   * Manually refresh the list
   */
  const refresh = async (): Promise<void> => {
    await fetchItems(searchQuery);
  };

  return {
    items,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    deleteItem,
    refresh,
  };
}
