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
  ReorderPlaylistItemsRequest,
  Session,
  CreateSessionRequest
} from '../../server/types/shared';

const API_BASE = '/api/library';
const MEDIA_BASE = '/api/media';
const PLAYLIST_BASE = '/api/playlists';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

async function fetchVoid(url: string, options?: RequestInit): Promise<void> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
}

function jsonBody(method: string, data: unknown): RequestInit {
  return { method, headers: JSON_HEADERS, body: JSON.stringify(data) };
}

/**
 * Library API client
 */
export const libraryApi = {
  async getAll(): Promise<LibraryItem[]> {
    return fetchJson(API_BASE);
  },

  async search(query: string): Promise<LibraryItem[]> {
    return fetchJson(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
  },

  async getById(id: number): Promise<LibraryItem> {
    return fetchJson(`${API_BASE}/${id}`);
  },

  async create(data: CreateLibraryItemRequest): Promise<LibraryItem> {
    return fetchJson(API_BASE, jsonBody('POST', data));
  },

  async save(data: CreateLibraryItemRequest): Promise<LibraryItem> {
    return fetchJson(API_BASE, jsonBody('PUT', data));
  },

  async deleteItem(id: number): Promise<void> {
    return fetchVoid(`${API_BASE}/${id}`, { method: 'DELETE' });
  },

  async getMigrationStatus(): Promise<{ migrated: boolean }> {
    return fetchJson(`${API_BASE}/migration-status`);
  },

  async migrate(data: MigrationRequest): Promise<{ success: boolean; count: number }> {
    return fetchJson(`${API_BASE}/migrate`, jsonBody('POST', data));
  },
};

/**
 * Custom Pattern API client
 * Provides CRUD operations for user-created custom patterns
 */
export const customPatternApi = {
  async getAll(): Promise<LibraryItem[]> {
    return fetchJson(`${API_BASE}/custom-patterns`);
  },

  async create(data: CreateLibraryItemRequest): Promise<LibraryItem> {
    return libraryApi.create(data);
  },

  async update(id: number, data: Partial<CreateLibraryItemRequest>): Promise<LibraryItem> {
    return fetchJson(`${API_BASE}/${id}`, jsonBody('PATCH', data));
  },

  async delete(id: number): Promise<void> {
    return fetchVoid(`${API_BASE}/custom-patterns/${id}`, { method: 'DELETE' });
  },
};

/**
 * Media API client — video file storage and streaming
 */
export const mediaApi = {
  async check(filename: string): Promise<{ exists: boolean; size?: number }> {
    const response = await fetch(`${MEDIA_BASE}/check/${encodeURIComponent(filename)}`);
    if (!response.ok) {
      return { exists: false };
    }
    return response.json();
  },

  streamUrl(filename: string): string {
    return `${MEDIA_BASE}/stream/${encodeURIComponent(filename)}`;
  },

  async upload(file: File): Promise<{ name: string; size: number; stored: boolean }> {
    const formData = new FormData();
    formData.append('video', file);
    return fetchJson(`${MEDIA_BASE}/upload`, { method: 'POST', body: formData });
  },

  thumbnailUrl(videoFilename: string): string {
    return `${MEDIA_BASE}/thumbnail/${encodeURIComponent(videoFilename)}`;
  },

  async uploadThumbnail(videoFilename: string, blob: Blob): Promise<void> {
    const ext = videoFilename.lastIndexOf('.');
    const baseName = ext > 0 ? videoFilename.substring(0, ext) : videoFilename;
    const thumbFilename = `${baseName}.jpg`;

    const formData = new FormData();
    formData.append('thumbnail', blob, thumbFilename);
    return fetchVoid(`${MEDIA_BASE}/thumbnail`, { method: 'POST', body: formData });
  },
};

/**
 * Playlist API client
 * Provides type-safe methods for playlist CRUD operations
 */
export const playlistApi = {
  async getAll(): Promise<Playlist[]> {
    return fetchJson(PLAYLIST_BASE);
  },

  async getById(id: number): Promise<Playlist> {
    return fetchJson(`${PLAYLIST_BASE}/${id}`);
  },

  async getItems(playlistId: number): Promise<PlaylistItem[]> {
    return fetchJson(`${PLAYLIST_BASE}/${playlistId}/items`);
  },

  async create(data: CreatePlaylistRequest): Promise<Playlist> {
    return fetchJson(PLAYLIST_BASE, jsonBody('POST', data));
  },

  async update(id: number, data: UpdatePlaylistRequest): Promise<Playlist> {
    return fetchJson(`${PLAYLIST_BASE}/${id}`, jsonBody('PATCH', data));
  },

  async deletePlaylist(id: number): Promise<void> {
    return fetchVoid(`${PLAYLIST_BASE}/${id}`, { method: 'DELETE' });
  },

  async addItem(playlistId: number, libraryItemId: number): Promise<PlaylistItem> {
    const body: AddPlaylistItemRequest = { libraryItemId };
    return fetchJson(`${PLAYLIST_BASE}/${playlistId}/items`, jsonBody('POST', body));
  },

  async removeItem(playlistId: number, itemId: number): Promise<void> {
    return fetchVoid(`${PLAYLIST_BASE}/${playlistId}/items/${itemId}`, { method: 'DELETE' });
  },

  async reorderItems(playlistId: number, itemIds: number[]): Promise<void> {
    const body: ReorderPlaylistItemsRequest = { itemIds };
    return fetchVoid(`${PLAYLIST_BASE}/${playlistId}/items/reorder`, jsonBody('PUT', body));
  },
};

/**
 * Session API client
 * Provides session tracking lifecycle methods
 */
const SESSION_BASE = '/api/sessions';

export const sessionApi = {
  async create(data: CreateSessionRequest): Promise<Session> {
    return fetchJson(SESSION_BASE, jsonBody('POST', data));
  },

  async end(id: number, endedAt?: string): Promise<Session> {
    return fetchJson(`${SESSION_BASE}/${id}/end`, jsonBody('POST', { endedAt: endedAt ?? new Date().toISOString() }));
  },

  async appendScript(sessionId: number, libraryItemId: number): Promise<Session> {
    return fetchJson(`${SESSION_BASE}/${sessionId}/scripts`, jsonBody('POST', {
      libraryItemId,
      timestamp: new Date().toISOString()
    }));
  },
};
