import type { LibraryItem, CreateLibraryItemRequest } from '../types/shared.js';
import type { LibraryRepository } from '../repositories/library.repository.js';

export interface MediaCleanup {
  deleteFiles(videoName: string): void;
}

export class LibraryService {
  private mediaCleanup: MediaCleanup | null = null;

  constructor(private repository: LibraryRepository) {}

  setMediaCleanup(cleanup: MediaCleanup): void {
    this.mediaCleanup = cleanup;
  }

  getAllItems(): LibraryItem[] {
    return this.repository.findAll();
  }

  getItemById(id: number): LibraryItem {
    const item = this.repository.findById(id);
    if (!item) {
      throw new Error(`Library item with id ${id} not found`);
    }
    return item;
  }

  searchItems(query: string): LibraryItem[] {
    if (!query || query.trim() === '') {
      return this.repository.findAll();
    }
    return this.repository.search(query);
  }

  createItem(data: CreateLibraryItemRequest): LibraryItem {
    // Validate required fields
    if (!data.funscriptData) {
      throw new Error('funscriptData is required');
    }
    return this.repository.create(data);
  }

  deleteItem(id: number): void {
    // Look up item first to get videoName for media cleanup
    const item = this.repository.findById(id);
    if (!item) {
      throw new Error(`Library item with id ${id} not found`);
    }

    this.repository.delete(id);

    // Clean up associated media files
    if (item.videoName && this.mediaCleanup) {
      try {
        this.mediaCleanup.deleteFiles(item.videoName);
      } catch (err) {
        // Log but don't fail the delete — DB record is already gone
        console.warn(`Failed to clean up media files for ${item.videoName}:`, err);
      }
    }
  }

  saveOrUpdateItem(data: CreateLibraryItemRequest): LibraryItem {
    return this.repository.upsertByVideoName(data);
  }

  getMigrationStatus(): boolean {
    return this.repository.getMigrationStatus();
  }

  migrateFromIndexedDB(items: CreateLibraryItemRequest[]): void {
    // Check if migration already completed - return silently for idempotency
    if (this.repository.getMigrationStatus()) {
      return;
    }

    // Bulk insert items
    this.repository.bulkCreate(items);

    // Mark migration as complete
    this.repository.setMigrationComplete();
  }
}
