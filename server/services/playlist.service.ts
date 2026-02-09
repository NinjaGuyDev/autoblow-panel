import type { Playlist, PlaylistItem, CreatePlaylistRequest, UpdatePlaylistRequest } from '../types/shared.js';
import type { PlaylistRepository } from '../repositories/playlist.repository.js';
import type { LibraryRepository } from '../repositories/library.repository.js';

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
      throw new Error(`Playlist with id ${id} not found`);
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
      throw new Error('Playlist name cannot be empty');
    }
    return this.playlistRepository.create(data);
  }

  updatePlaylist(id: number, data: UpdatePlaylistRequest): Playlist {
    // Verify exists
    this.getPlaylistById(id);

    // Validate name if provided
    if (data.name !== undefined && data.name.trim() === '') {
      throw new Error('Playlist name cannot be empty');
    }

    return this.playlistRepository.update(id, data);
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
      throw new Error(`Library item with id ${libraryItemId} not found`);
    }

    return this.playlistRepository.addItem(playlistId, libraryItemId);
  }

  removeItem(itemId: number): void {
    this.playlistRepository.removeItem(itemId);
  }

  reorderItems(playlistId: number, itemIds: number[]): void {
    // Verify playlist exists
    this.getPlaylistById(playlistId);
    this.playlistRepository.reorderItems(playlistId, itemIds);
  }
}
