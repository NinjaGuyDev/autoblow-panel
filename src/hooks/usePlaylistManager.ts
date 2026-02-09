/**
 * Playlist management hook for CRUD operations on playlists
 * Provides state management for playlist list view and active playlist editing
 */

import { useState, useEffect, useCallback } from 'react';
import { playlistApi, libraryApi } from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/getErrorMessage';
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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [activeItems, setActiveItems] = useState<PlaylistItem[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);

  /**
   * Fetch all playlists
   */
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const results = await playlistApi.getAll();
      setPlaylists(results);
    } catch (err) {
      const errorMessage = getErrorMessage(err, 'Failed to fetch playlists');
      setError(errorMessage);
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new playlist
   */
  const createPlaylist = async (name: string, description?: string): Promise<Playlist> => {
    try {
      const created = await playlistApi.create({
        name,
        description: description || null,
      });
      await refresh();
      return created;
    } catch (err) {
      const errorMessage = getErrorMessage(err, 'Failed to create playlist');
      setError(errorMessage);
      throw err;
    }
  };

  /**
   * Delete a playlist
   */
  const deletePlaylist = async (id: number): Promise<void> => {
    try {
      await playlistApi.deletePlaylist(id);
      // If deleting the active playlist, close it
      if (activePlaylist?.id === id) {
        setActivePlaylist(null);
        setActiveItems([]);
      }
      await refresh();
    } catch (err) {
      const errorMessage = getErrorMessage(err, 'Failed to delete playlist');
      setError(errorMessage);
      throw err;
    }
  };

  /**
   * Select a playlist for editing
   */
  const selectPlaylist = async (id: number): Promise<void> => {
    try {
      setError(null);
      const playlist = await playlistApi.getById(id);
      const items = await playlistApi.getItems(id);
      setActivePlaylist(playlist);
      setActiveItems(items);
    } catch (err) {
      const errorMessage = getErrorMessage(err, 'Failed to load playlist');
      setError(errorMessage);
      throw err;
    }
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

    try {
      setError(null);
      await playlistApi.addItem(activePlaylist.id, libraryItemId);
      // Refresh items to get updated list with joined data
      const items = await playlistApi.getItems(activePlaylist.id);
      setActiveItems(items);
    } catch (err) {
      const errorMessage = getErrorMessage(err, 'Failed to add item to playlist');
      setError(errorMessage);
      throw err;
    }
  };

  /**
   * Remove an item from the active playlist
   */
  const removeItem = async (itemId: number): Promise<void> => {
    if (!activePlaylist) return;

    try {
      setError(null);
      await playlistApi.removeItem(activePlaylist.id, itemId);
      // Refresh items to get compacted positions
      const items = await playlistApi.getItems(activePlaylist.id);
      setActiveItems(items);
    } catch (err) {
      const errorMessage = getErrorMessage(err, 'Failed to remove item');
      setError(errorMessage);
      throw err;
    }
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
      setError(null);
      await playlistApi.reorderItems(activePlaylist.id, itemIds);
      // Refresh to sync with backend (in case of concurrent edits)
      const items = await playlistApi.getItems(activePlaylist.id);
      setActiveItems(items);
    } catch (err) {
      // Revert on error
      setActiveItems(previousItems);
      const errorMessage = getErrorMessage(err, 'Failed to reorder items');
      setError(errorMessage);
      throw err;
    }
  };

  /**
   * Load library items for "add to playlist" picker
   * Filters to only items with videoName (playlists are video-focused)
   */
  const loadLibraryItems = async (): Promise<void> => {
    try {
      setError(null);
      const items = await libraryApi.getAll();
      // Filter to video-associated items only
      const videoItems = items.filter((item) => item.videoName !== null);
      setLibraryItems(videoItems);
    } catch (err) {
      const errorMessage = getErrorMessage(err, 'Failed to load library items');
      setError(errorMessage);
      throw err;
    }
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
