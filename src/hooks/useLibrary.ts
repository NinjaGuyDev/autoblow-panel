/**
 * Library data hook for fetching, searching, and managing library items
 * Provides client-side filtering and debounced search
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { libraryApi } from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/getErrorMessage';
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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
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
      setLoading(true);
      setError(null);
      
      const results = query.trim() === '' 
        ? await libraryApi.getAll() 
        : await libraryApi.search(query);
      
      setRawItems(results);
    } catch (err) {
      const errorMessage = getErrorMessage(err, 'Failed to fetch library items');
      setError(errorMessage);
      setRawItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Apply client-side filter to raw items
   */
  const applyFilter = useCallback((itemsToFilter: LibraryItem[], currentFilter: LibraryFilter): LibraryItem[] => {
    switch (currentFilter) {
      case 'has-video':
        return itemsToFilter.filter(item => item.videoName !== null);
      case 'has-funscript':
        return itemsToFilter.filter(item => item.funscriptName !== null);
      case 'all':
      default:
        return itemsToFilter;
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
    try {
      await libraryApi.deleteItem(id);
      await fetchItems(searchQuery);
    } catch (err) {
      const errorMessage = getErrorMessage(err, 'Failed to delete item');
      setError(errorMessage);
      throw err;
    }
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
