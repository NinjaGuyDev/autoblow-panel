import type Database from 'better-sqlite3';
import type { Playlist, PlaylistItem, CreatePlaylistRequest, UpdatePlaylistRequest } from '../types/shared.js';

export class PlaylistRepository {
  constructor(private db: Database.Database) {}

  findAll(): Playlist[] {
    const stmt = this.db.prepare(`
      SELECT
        p.*,
        COUNT(pi.id) as itemCount
      FROM playlists p
      LEFT JOIN playlist_items pi ON p.id = pi.playlist_id
      GROUP BY p.id
      ORDER BY p.lastModified DESC
    `);
    return stmt.all() as Playlist[];
  }

  findById(id: number): Playlist | undefined {
    const stmt = this.db.prepare(`
      SELECT
        p.*,
        COUNT(pi.id) as itemCount
      FROM playlists p
      LEFT JOIN playlist_items pi ON p.id = pi.playlist_id
      WHERE p.id = ?
      GROUP BY p.id
    `);
    return stmt.get(id) as Playlist | undefined;
  }

  findItemsByPlaylistId(playlistId: number): PlaylistItem[] {
    const stmt = this.db.prepare(`
      SELECT
        pi.id,
        pi.playlist_id as playlistId,
        pi.library_item_id as libraryItemId,
        pi.position,
        li.videoName,
        li.funscriptName,
        li.duration
      FROM playlist_items pi
      INNER JOIN library_items li ON pi.library_item_id = li.id
      WHERE pi.playlist_id = ?
      ORDER BY pi.position ASC
    `);
    return stmt.all(playlistId) as PlaylistItem[];
  }

  create(data: CreatePlaylistRequest): Playlist {
    const stmt = this.db.prepare(`
      INSERT INTO playlists (name, description)
      VALUES (?, ?)
      RETURNING *
    `);
    const row = stmt.get(data.name, data.description ?? null) as Playlist;
    // Add itemCount for consistency
    return { ...row, itemCount: 0 };
  }

  update(id: number, data: UpdatePlaylistRequest): Playlist {
    const lastModified = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE playlists
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          lastModified = ?
      WHERE id = ?
      RETURNING *
    `);
    const row = stmt.get(
      data.name ?? null,
      data.description ?? null,
      lastModified,
      id
    ) as Playlist;

    // Get item count
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as itemCount FROM playlist_items WHERE playlist_id = ?
    `);
    const { itemCount } = countStmt.get(id) as { itemCount: number };
    return { ...row, itemCount };
  }

  delete(id: number): number {
    const stmt = this.db.prepare(`
      DELETE FROM playlists WHERE id = ?
    `);
    const result = stmt.run(id);
    return result.changes;
  }

  addItem(playlistId: number, libraryItemId: number): PlaylistItem {
    // Calculate next position
    const positionStmt = this.db.prepare(`
      SELECT COALESCE(MAX(position), -1) + 1 as nextPosition
      FROM playlist_items
      WHERE playlist_id = ?
    `);
    const { nextPosition } = positionStmt.get(playlistId) as { nextPosition: number };

    // Insert the item
    const insertStmt = this.db.prepare(`
      INSERT INTO playlist_items (playlist_id, library_item_id, position)
      VALUES (?, ?, ?)
      RETURNING *
    `);
    const insertedRow = insertStmt.get(playlistId, libraryItemId, nextPosition) as {
      id: number;
      playlist_id: number;
      library_item_id: number;
      position: number;
    };

    // Get library item details
    const selectStmt = this.db.prepare(`
      SELECT
        pi.id,
        pi.playlist_id as playlistId,
        pi.library_item_id as libraryItemId,
        pi.position,
        li.videoName,
        li.funscriptName,
        li.duration
      FROM playlist_items pi
      INNER JOIN library_items li ON pi.library_item_id = li.id
      WHERE pi.id = ?
    `);
    return selectStmt.get(insertedRow.id) as PlaylistItem;
  }

  removeItem(itemId: number): void {
    // Get the item's playlist_id and position first
    const selectStmt = this.db.prepare(`
      SELECT playlist_id, position FROM playlist_items WHERE id = ?
    `);
    const item = selectStmt.get(itemId) as { playlist_id: number; position: number } | undefined;

    if (!item) {
      return; // Item doesn't exist, nothing to do
    }

    // Delete the item
    const deleteStmt = this.db.prepare(`
      DELETE FROM playlist_items WHERE id = ?
    `);
    deleteStmt.run(itemId);

    // Compact positions - shift down all items that were after this one
    const updateStmt = this.db.prepare(`
      UPDATE playlist_items
      SET position = position - 1
      WHERE playlist_id = ? AND position > ?
    `);
    updateStmt.run(item.playlist_id, item.position);
  }

  reorderItems(playlistId: number, itemIds: number[]): void {
    const updateStmt = this.db.prepare(`
      UPDATE playlist_items
      SET position = ?
      WHERE id = ?
    `);

    const updateLastModifiedStmt = this.db.prepare(`
      UPDATE playlists
      SET lastModified = ?
      WHERE id = ?
    `);

    // Use transaction for atomicity
    const reorder = this.db.transaction((ids: number[]) => {
      ids.forEach((id, index) => {
        updateStmt.run(index, id);
      });
      updateLastModifiedStmt.run(new Date().toISOString(), playlistId);
    });

    reorder(itemIds);
  }
}
