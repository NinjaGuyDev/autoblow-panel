import type { LibraryItem, CreateLibraryItemRequest } from '../types/shared.js';
import type { LibraryRepository } from '../repositories/library.repository.js';
import { NotFoundError, ValidationError, ConflictError } from '../errors/domain-errors.js';
import type { MediaFileService } from './media-file.service.js';

export class LibraryService {
  constructor(
    private repository: LibraryRepository,
    private mediaFileService: MediaFileService,
  ) {}

  getAllItems(): LibraryItem[] {
    return this.repository.findAll();
  }

  getItemById(id: number): LibraryItem {
    const item = this.repository.findById(id);
    if (!item) {
      throw new NotFoundError(`Library item with id ${id} not found`);
    }
    return item;
  }

  searchItems(query: string): LibraryItem[] {
    if (!query || query.trim() === '') {
      return this.repository.findAll();
    }
    return this.repository.search(query);
  }

  getCustomPatterns(): LibraryItem[] {
    return this.repository.findCustomPatterns();
  }

  updateItemById(id: number, data: Partial<CreateLibraryItemRequest>): LibraryItem {
    const item = this.repository.findById(id);
    if (!item) {
      throw new NotFoundError(`Library item with id ${id} not found`);
    }
    return this.repository.updateById(id, data);
  }

  updateCustomPattern(id: number, data: Partial<CreateLibraryItemRequest>): LibraryItem {
    // Verify item exists and is a custom pattern
    const item = this.repository.findById(id);
    if (!item) {
      throw new NotFoundError(`Library item with id ${id} not found`);
    }
    if (item.isCustomPattern !== 1) {
      throw new ValidationError(`Library item with id ${id} is not a custom pattern`);
    }
    return this.repository.updateCustomPattern(id, data);
  }

  softDeleteCustomPattern(id: number): void {
    const item = this.repository.findById(id);
    if (!item) {
      throw new NotFoundError(`Library item with id ${id} not found`);
    }
    if (item.isCustomPattern !== 1) {
      throw new ValidationError(`Library item with id ${id} is not a custom pattern`);
    }
    const changes = this.repository.softDelete(id);
    if (changes === 0) {
      throw new ConflictError(`Library item with id ${id} is already deleted`);
    }
  }

  createItem(data: CreateLibraryItemRequest): LibraryItem {
    // Validate required fields
    if (!data.funscriptData) {
      throw new ValidationError('funscriptData is required');
    }
    return this.repository.create(data);
  }

  deleteItem(id: number): void {
    const item = this.repository.findById(id);
    if (!item) {
      throw new NotFoundError(`Library item with id ${id} not found`);
    }

    this.repository.delete(id);

    if (item.videoName) {
      try {
        this.mediaFileService.deleteVideoFile(item.videoName);
        this.mediaFileService.deleteThumbnailFile(item.videoName);
      } catch (err) {
        console.warn(`Failed to clean up media files for ${item.videoName}:`, err);
      }
    }

    if (item.patternMetadata) {
      try {
        const metadata = JSON.parse(item.patternMetadata);
        if (metadata.audioFile) {
          this.mediaFileService.deleteAudioFile(metadata.audioFile);
        }
      } catch {
        // Malformed metadata — skip audio cleanup
      }
    }
  }

  saveOrUpdateItem(data: CreateLibraryItemRequest): LibraryItem {
    return this.repository.upsertByVideoName(data);
  }

  getMigrationStatus(): boolean {
    return this.repository.getMigrationStatus();
  }

  migrateFromIndexedDB(items: CreateLibraryItemRequest[]): number {
    // Check if migration already completed - return silently for idempotency
    if (this.repository.getMigrationStatus()) {
      return 0;
    }

    // Bulk insert items
    this.repository.bulkCreate(items);

    // Mark migration as complete
    this.repository.setMigrationComplete();

    return items.length;
  }
}
