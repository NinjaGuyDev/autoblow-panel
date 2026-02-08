import type { LibraryItem, CreateLibraryItemRequest } from '../types/shared.js';
import type { LibraryRepository } from '../repositories/library.repository.js';

export class LibraryService {
  constructor(private repository: LibraryRepository) {}

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
    const changes = this.repository.delete(id);
    if (changes === 0) {
      throw new Error(`Library item with id ${id} not found`);
    }
  }

  saveOrUpdateItem(data: CreateLibraryItemRequest): LibraryItem {
    return this.repository.upsertByVideoName(data);
  }

  getMigrationStatus(): boolean {
    return this.repository.getMigrationStatus();
  }

  migrateFromIndexedDB(items: CreateLibraryItemRequest[]): void {
    // Check if migration already completed
    if (this.repository.getMigrationStatus()) {
      throw new Error('Migration has already been completed');
    }

    // Bulk insert items
    this.repository.bulkCreate(items);

    // Mark migration as complete
    this.repository.setMigrationComplete();
  }
}
