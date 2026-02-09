/**
 * Playlist management hook for CRUD operations on playlists
 * Provides state management for playlist list view and active playlist editing
 */

import { useState, useEffect, useCallback } from 'react';
import { playlistApi, libraryApi } from '@/lib/apiClient';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';
import type { Playlist, PlaylistItem, LibraryItem } from '../../server/types/shared';

export interface UsePlaylistManagerReturn {
  // Playlist list view
  playlists: Playlist[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;

  // CRUD operations
  createPlaylist: (name: string, description?: string) => Promise<Playlist>;
  deletePlaylist: (id: number) => Promise<void>;

  // Active playlist editing
  activePlaylist: Playlist | null;
  activeItems: PlaylistItem[];
  selectPlaylist: (id: number) => Promise<void>;
  closePlaylist: () => void;

  // Item management on active playlist
  addItem: (libraryItemId: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  reorderItems: (itemIds: number[]) => Promise<void>;

  // Library items for "add to playlist" picker
  libraryItems: LibraryItem[];
  loadLibraryItems: () => Promise<void>;
}

/**
 * Hook for managing playlist CRUD and item management
 */
export function usePlaylistManager(): UsePlaylistManagerReturn {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const { loading, error, run, execute } = useAsyncOperation(true);
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [activeItems, setActiveItems] = useState<PlaylistItem[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);

  /**
   * Fetch all playlists
   */
  const refresh = useCallback(async () => {
    try {
      const results = await run(
        () => playlistApi.getAll(),
        'Failed to fetch playlists',
      );
      setPlaylists(results);
    } catch {
      setPlaylists([]);
    }
  }, [run]);

  /**
   * Create a new playlist
   */
  const createPlaylist = async (name: string, description?: string): Promise<Playlist> => {
    const created = await execute(
      () => playlistApi.create({ name, description: description || null }),
      'Failed to create playlist',
    );
    await refresh();
    return created;
  };

  /**
   * Delete a playlist
   */
  const deletePlaylist = async (id: number): Promise<void> => {
    await execute(
      () => playlistApi.deletePlaylist(id),
      'Failed to delete playlist',
    );
    // If deleting the active playlist, close it
    if (activePlaylist?.id === id) {
      setActivePlaylist(null);
      setActiveItems([]);
    }
    await refresh();
  };

  /**
   * Select a playlist for editing
   */
  const selectPlaylist = async (id: number): Promise<void> => {
    const [playlist, items] = await execute(
      () => Promise.all([playlistApi.getById(id), playlistApi.getItems(id)]),
      'Failed to load playlist',
    );
    setActivePlaylist(playlist);
    setActiveItems(items);
  };

  /**
   * Close the active playlist editor
   */
  const closePlaylist = (): void => {
    setActivePlaylist(null);
    setActiveItems([]);
  };

  /**
   * Add a library item to the active playlist
   */
  const addItem = async (libraryItemId: number): Promise<void> => {
    if (!activePlaylist) return;

    await execute(
      async () => {
        await playlistApi.addItem(activePlaylist.id, libraryItemId);
        const items = await playlistApi.getItems(activePlaylist.id);
        setActiveItems(items);
      },
      'Failed to add item to playlist',
    );
  };

  /**
   * Remove an item from the active playlist
   */
  const removeItem = async (itemId: number): Promise<void> => {
    if (!activePlaylist) return;

    await execute(
      async () => {
        await playlistApi.removeItem(activePlaylist.id, itemId);
        const items = await playlistApi.getItems(activePlaylist.id);
        setActiveItems(items);
      },
      'Failed to remove item',
    );
  };

  /**
   * Reorder items in the active playlist
   * Uses optimistic update with revert on error
   */
  const reorderItems = async (itemIds: number[]): Promise<void> => {
    if (!activePlaylist) return;

    // Optimistic update: reorder items locally first
    const previousItems = [...activeItems];
    const reorderedItems = itemIds
      .map((id, index) => {
        const item = activeItems.find((i) => i.id === id);
        return item ? { ...item, position: index } : null;
      })
      .filter((item): item is PlaylistItem => item !== null);

    setActiveItems(reorderedItems);

    try {
      await execute(
        async () => {
          await playlistApi.reorderItems(activePlaylist.id, itemIds);
          const items = await playlistApi.getItems(activePlaylist.id);
          setActiveItems(items);
        },
        'Failed to reorder items',
      );
    } catch {
      // Revert on error
      setActiveItems(previousItems);
    }
  };

  /**
   * Load library items for "add to playlist" picker
   * Filters to only items with videoName (playlists are video-focused)
   */
  const loadLibraryItems = async (): Promise<void> => {
    const items = await execute(
      () => libraryApi.getAll(),
      'Failed to load library items',
    );
    const videoItems = items.filter((item) => item.videoName !== null);
    setLibraryItems(videoItems);
  };

  /**
   * Initial load on mount
   */
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    playlists,
    loading,
    error,
    refresh,
    createPlaylist,
    deletePlaylist,
    activePlaylist,
    activeItems,
    selectPlaylist,
    closePlaylist,
    addItem,
    removeItem,
    reorderItems,
    libraryItems,
    loadLibraryItems,
  };
}
