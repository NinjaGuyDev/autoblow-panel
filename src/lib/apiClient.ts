/**
 * API client for backend library endpoints
 * Provides type-safe methods for CRUD operations on library items
 */

import type {
  LibraryItem,
  CreateLibraryItemRequest,
  MigrationRequest,
  Playlist,
  PlaylistItem,
  CreatePlaylistRequest,
  UpdatePlaylistRequest,
  AddPlaylistItemRequest,
  ReorderPlaylistItemsRequest
} from '../../server/types/shared';

const API_BASE = '/api/library';
const MEDIA_BASE = '/api/media';
const PLAYLIST_BASE = '/api/playlists';

/**
 * Library API client
 */
export const libraryApi = {
  /**
   * Get all library items
   */
  async getAll(): Promise<LibraryItem[]> {
    const response = await fetch(API_BASE);
    if (!response.ok) {
      throw new Error(`Failed to fetch library items: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Search library items by query string
   * Searches in both videoName and funscriptName
   */
  async search(query: string): Promise<LibraryItem[]> {
    const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`Failed to search library items: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Get a single library item by ID
   */
  async getById(id: number): Promise<LibraryItem> {
    const response = await fetch(`${API_BASE}/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch library item: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Create a new library item
   */
  async create(data: CreateLibraryItemRequest): Promise<LibraryItem> {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to create library item: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Save or update a library item
   * Upserts by videoName
   */
  async save(data: CreateLibraryItemRequest): Promise<LibraryItem> {
    const response = await fetch(API_BASE, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to save library item: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Delete a library item by ID
   */
  async deleteItem(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete library item: ${response.statusText}`);
    }
  },

  /**
   * Check migration status
   * Returns whether IndexedDB to SQLite migration has completed
   */
  async getMigrationStatus(): Promise<{ migrated: boolean }> {
    const response = await fetch(`${API_BASE}/migration-status`);
    if (!response.ok) {
      throw new Error(`Failed to check migration status: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Migrate data from IndexedDB to SQLite
   * Bulk creates library items and marks migration complete
   */
  async migrate(data: MigrationRequest): Promise<{ success: boolean; count: number }> {
    const response = await fetch(`${API_BASE}/migrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to migrate data: ${response.statusText}`);
    }
    return response.json();
  },
};

/**
 * Custom Pattern API client
 * Provides CRUD operations for user-created custom patterns
 */
export const customPatternApi = {
  /**
   * Get all custom patterns
   */
  async getAll(): Promise<LibraryItem[]> {
    const response = await fetch(`${API_BASE}/custom-patterns`);
    if (!response.ok) {
      throw new Error(`Failed to fetch custom patterns: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Create a new custom pattern
   * Reuses libraryApi.create with isCustomPattern=1
   */
  async create(data: CreateLibraryItemRequest): Promise<LibraryItem> {
    return libraryApi.create(data);
  },

  /**
   * Update a custom pattern
   */
  async update(id: number, data: Partial<CreateLibraryItemRequest>): Promise<LibraryItem> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to update custom pattern: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Delete a custom pattern
   * Reuses libraryApi.deleteItem
   */
  async delete(id: number): Promise<void> {
    return libraryApi.deleteItem(id);
  },
};

/**
 * Media API client — video file storage and streaming
 */
export const mediaApi = {
  /**
   * Check if a video file exists in the media directory
   */
  async check(filename: string): Promise<{ exists: boolean; size?: number }> {
    const response = await fetch(`${MEDIA_BASE}/check/${encodeURIComponent(filename)}`);
    if (!response.ok) {
      return { exists: false };
    }
    return response.json();
  },

  /**
   * Get the streaming URL for a video file
   */
  streamUrl(filename: string): string {
    return `${MEDIA_BASE}/stream/${encodeURIComponent(filename)}`;
  },

  /**
   * Upload a video file to the media directory
   */
  async upload(file: File): Promise<{ name: string; size: number; stored: boolean }> {
    const formData = new FormData();
    formData.append('video', file);

    const response = await fetch(`${MEDIA_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`Failed to upload video: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Get the URL for a video thumbnail
   */
  thumbnailUrl(videoFilename: string): string {
    return `${MEDIA_BASE}/thumbnail/${encodeURIComponent(videoFilename)}`;
  },

  /**
   * Upload a thumbnail image for a video
   */
  async uploadThumbnail(videoFilename: string, blob: Blob): Promise<void> {
    const ext = videoFilename.lastIndexOf('.');
    const baseName = ext > 0 ? videoFilename.substring(0, ext) : videoFilename;
    const thumbFilename = `${baseName}.jpg`;

    const formData = new FormData();
    formData.append('thumbnail', blob, thumbFilename);

    const response = await fetch(`${MEDIA_BASE}/thumbnail`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`Failed to upload thumbnail: ${response.statusText}`);
    }
  },
};

/**
 * Playlist API client
 * Provides type-safe methods for playlist CRUD operations
 */
export const playlistApi = {
  /**
   * Get all playlists with item counts
   */
  async getAll(): Promise<Playlist[]> {
    const response = await fetch(PLAYLIST_BASE);
    if (!response.ok) {
      throw new Error(`Failed to fetch playlists: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Get a single playlist by ID
   */
  async getById(id: number): Promise<Playlist> {
    const response = await fetch(`${PLAYLIST_BASE}/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch playlist: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Get all items in a playlist with library item details
   */
  async getItems(playlistId: number): Promise<PlaylistItem[]> {
    const response = await fetch(`${PLAYLIST_BASE}/${playlistId}/items`);
    if (!response.ok) {
      throw new Error(`Failed to fetch playlist items: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Create a new playlist
   */
  async create(data: CreatePlaylistRequest): Promise<Playlist> {
    const response = await fetch(PLAYLIST_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to create playlist: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Update a playlist's name or description
   */
  async update(id: number, data: UpdatePlaylistRequest): Promise<Playlist> {
    const response = await fetch(`${PLAYLIST_BASE}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to update playlist: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Delete a playlist (cascades to remove all items)
   */
  async deletePlaylist(id: number): Promise<void> {
    const response = await fetch(`${PLAYLIST_BASE}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete playlist: ${response.statusText}`);
    }
  },

  /**
   * Add a library item to a playlist
   */
  async addItem(playlistId: number, libraryItemId: number): Promise<PlaylistItem> {
    const body: AddPlaylistItemRequest = { libraryItemId };
    const response = await fetch(`${PLAYLIST_BASE}/${playlistId}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Failed to add item to playlist: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Remove an item from a playlist
   */
  async removeItem(playlistId: number, itemId: number): Promise<void> {
    const response = await fetch(`${PLAYLIST_BASE}/${playlistId}/items/${itemId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to remove item from playlist: ${response.statusText}`);
    }
  },

  /**
   * Reorder items in a playlist
   */
  async reorderItems(playlistId: number, itemIds: number[]): Promise<void> {
    const body: ReorderPlaylistItemsRequest = { itemIds };
    const response = await fetch(`${PLAYLIST_BASE}/${playlistId}/items/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Failed to reorder playlist items: ${response.statusText}`);
    }
  },
};
