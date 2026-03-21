import type { Playlist, PlaylistItem, CreatePlaylistRequest, UpdatePlaylistRequest } from '../types/shared.js';
import type { PlaylistRepository } from '../repositories/playlist.repository.js';
import type { LibraryRepository } from '../repositories/library.repository.js';
import { NotFoundError, ValidationError } from '../errors/domain-errors.js';

export class PlaylistService {
  constructor(
    private playlistRepository: PlaylistRepository,
    private libraryRepository: LibraryRepository
  ) {}

  getAllPlaylists(): Playlist[] {
    return this.playlistRepository.findAll();
  }

  getPlaylistById(id: number): Playlist {
    const playlist = this.playlistRepository.findById(id);
    if (!playlist) {
      throw new NotFoundError(`Playlist with id ${id} not found`);
    }
    return playlist;
  }

  getPlaylistItems(playlistId: number): PlaylistItem[] {
    // Verify playlist exists first
    this.getPlaylistById(playlistId);
    return this.playlistRepository.findItemsByPlaylistId(playlistId);
  }

  createPlaylist(data: CreatePlaylistRequest): Playlist {
    // Validate name is non-empty
    if (!data.name || data.name.trim() === '') {
      throw new ValidationError('Playlist name cannot be empty');
    }
    return this.playlistRepository.create(data);
  }

  updatePlaylist(id: number, data: UpdatePlaylistRequest): Playlist {
    // Validate name if provided
    if (data.name !== undefined && data.name.trim() === '') {
      throw new ValidationError('Playlist name cannot be empty');
    }

    const updated = this.playlistRepository.update(id, data);
    if (!updated) {
      throw new NotFoundError(`Playlist with id ${id} not found`);
    }
    return updated;
  }

  deletePlaylist(id: number): void {
    // Verify exists
    this.getPlaylistById(id);
    this.playlistRepository.delete(id);
  }

  addItem(playlistId: number, libraryItemId: number): PlaylistItem {
    // Verify playlist exists
    this.getPlaylistById(playlistId);

    // Verify library item exists
    const libraryItem = this.libraryRepository.findById(libraryItemId);
    if (!libraryItem) {
      throw new NotFoundError(`Library item with id ${libraryItemId} not found`);
    }

    return this.playlistRepository.addItem(playlistId, libraryItemId);
  }

  removeItem(itemId: number): void {
    const removed = this.playlistRepository.removeItem(itemId);
    if (!removed) {
      throw new NotFoundError(`Playlist item with id ${itemId} not found`);
    }
  }

  reorderItems(playlistId: number, itemIds: number[]): void {
    // Verify playlist exists
    this.getPlaylistById(playlistId);
    this.playlistRepository.reorderItems(playlistId, itemIds);
  }
}
