/**
 * Base hook for searchable library data with debounced search, delete, and refresh.
 * Parameterized by a filter predicate to support different library views
 * (video library, script-only library, etc.).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { libraryApi } from '@/lib/apiClient';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';
import type { LibraryItem } from '@server/types/shared';

interface UseSearchableLibraryOptions {
  /** Predicate applied to every fetched item; only matching items are returned. */
  filter: (item: LibraryItem) => boolean;
  /** Error message shown when fetching fails. */
  fetchErrorMessage?: string;
  /** Error message shown when deleting fails. */
  deleteErrorMessage?: string;
}

interface UseSearchableLibraryReturn {
  items: LibraryItem[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  deleteItem: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useSearchableLibrary({
  filter,
  fetchErrorMessage = 'Failed to fetch library items',
  deleteErrorMessage = 'Failed to delete item',
}: UseSearchableLibraryOptions): UseSearchableLibraryReturn {
  const [rawItems, setRawItems] = useState<LibraryItem[]>([]);
  const { loading, error, run, execute } = useAsyncOperation(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchItems = useCallback(async (query: string) => {
    try {
      const results = await run(
        () => query.trim() === '' ? libraryApi.getAll() : libraryApi.search(query),
        fetchErrorMessage,
      );
      setRawItems(results);
    } catch {
      setRawItems([]);
    }
  }, [run, fetchErrorMessage]);

  // Derive filtered items from raw items (no extra state or useEffect needed)
  const items = useMemo(() => rawItems.filter(filter), [rawItems, filter]);

  // Debounced search with leading: true so first call fires immediately (no double fetch)
  const debouncedFetch = useDebouncedCallback(
    (query: string) => fetchItems(query),
    300,
    { leading: true },
  );

  // Trigger fetch when search query changes (leading: true handles initial load)
  useEffect(() => {
    debouncedFetch(searchQuery);
  }, [searchQuery, debouncedFetch]);

  const deleteItem = useCallback(async (id: number): Promise<void> => {
    await execute(
      () => libraryApi.deleteItem(id),
      deleteErrorMessage,
    );
    await fetchItems(searchQuery);
  }, [execute, fetchItems, searchQuery, deleteErrorMessage]);

  const refresh = useCallback(async (): Promise<void> => {
    await fetchItems(searchQuery);
  }, [fetchItems, searchQuery]);

  return {
    items,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    deleteItem,
    refresh,
  };
}
