/**
 * API client for backend library endpoints
 * Provides type-safe methods for CRUD operations on library items
 */

import type { LibraryItem, CreateLibraryItemRequest, MigrationRequest } from '../../server/types/shared';

const API_BASE = '/api/library';

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
