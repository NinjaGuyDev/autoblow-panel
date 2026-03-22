import type Database from 'better-sqlite3';
import type { Playlist, PlaylistItem, CreatePlaylistRequest, UpdatePlaylistRequest } from '../types/shared.js';

export class PlaylistRepository {
  private readonly findAllStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly findItemByIdStmt: Database.Statement;
  private readonly findItemsByPlaylistIdStmt: Database.Statement;
  private readonly createStmt: Database.Statement;
  private readonly updateStmt: Database.Statement;
  private readonly itemCountStmt: Database.Statement;
  private readonly deleteStmt: Database.Statement;
  private readonly nextPositionStmt: Database.Statement;
  private readonly insertItemStmt: Database.Statement;
  private readonly selectItemWithJoinStmt: Database.Statement;
  private readonly selectItemForRemoveStmt: Database.Statement;
  private readonly deleteItemStmt: Database.Statement;
  private readonly compactPositionsStmt: Database.Statement;
  private readonly updateItemPositionStmt: Database.Statement;
  private readonly updatePlaylistLastModifiedStmt: Database.Statement;

  constructor(private db: Database.Database) {
    this.findAllStmt = db.prepare(`
      SELECT
        p.*,
        COUNT(pi.id) as itemCount
      FROM playlists p
      LEFT JOIN playlist_items pi ON p.id = pi.playlist_id
      GROUP BY p.id
      ORDER BY p.lastModified DESC
    `);

    this.findByIdStmt = db.prepare(`
      SELECT
        p.*,
        COUNT(pi.id) as itemCount
      FROM playlists p
      LEFT JOIN playlist_items pi ON p.id = pi.playlist_id
      WHERE p.id = ?
      GROUP BY p.id
    `);

    this.findItemByIdStmt = db.prepare(`
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

    this.findItemsByPlaylistIdStmt = db.prepare(`
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

    this.createStmt = db.prepare(`
      INSERT INTO playlists (name, description)
      VALUES (?, ?)
      RETURNING *
    `);

    this.updateStmt = db.prepare(`
      UPDATE playlists
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          lastModified = ?
      WHERE id = ?
      RETURNING *
    `);

    this.itemCountStmt = db.prepare(`
      SELECT COUNT(*) as itemCount FROM playlist_items WHERE playlist_id = ?
    `);

    this.deleteStmt = db.prepare(`
      DELETE FROM playlists WHERE id = ?
    `);

    this.nextPositionStmt = db.prepare(`
      SELECT COALESCE(MAX(position), -1) + 1 as nextPosition
      FROM playlist_items
      WHERE playlist_id = ?
    `);

    this.insertItemStmt = db.prepare(`
      INSERT INTO playlist_items (playlist_id, library_item_id, position)
      VALUES (?, ?, ?)
      RETURNING *
    `);

    this.selectItemWithJoinStmt = db.prepare(`
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

    this.selectItemForRemoveStmt = db.prepare(`
      SELECT playlist_id, position FROM playlist_items WHERE id = ?
    `);

    this.deleteItemStmt = db.prepare(`
      DELETE FROM playlist_items WHERE id = ?
    `);

    this.compactPositionsStmt = db.prepare(`
      UPDATE playlist_items
      SET position = position - 1
      WHERE playlist_id = ? AND position > ?
    `);

    this.updateItemPositionStmt = db.prepare(`
      UPDATE playlist_items
      SET position = ?
      WHERE id = ?
    `);

    this.updatePlaylistLastModifiedStmt = db.prepare(`
      UPDATE playlists
      SET lastModified = ?
      WHERE id = ?
    `);
  }

  findAll(): Playlist[] {
    return this.findAllStmt.all() as Playlist[];
  }

  findById(id: number): Playlist | undefined {
    return this.findByIdStmt.get(id) as Playlist | undefined;
  }

  findItemById(itemId: number): PlaylistItem | undefined {
    return this.findItemByIdStmt.get(itemId) as PlaylistItem | undefined;
  }

  findItemsByPlaylistId(playlistId: number): PlaylistItem[] {
    return this.findItemsByPlaylistIdStmt.all(playlistId) as PlaylistItem[];
  }

  create(data: CreatePlaylistRequest): Playlist {
    const row = this.createStmt.get(data.name, data.description ?? null) as Playlist;
    return { ...row, itemCount: 0 };
  }

  update(id: number, data: UpdatePlaylistRequest): Playlist | undefined {
    const lastModified = new Date().toISOString();

    const runUpdate = this.db.transaction(() => {
      const row = this.updateStmt.get(
        data.name ?? null,
        data.description ?? null,
        lastModified,
        id
      ) as Playlist | undefined;

      if (!row) return undefined;

      const { itemCount } = this.itemCountStmt.get(id) as { itemCount: number };
      return { ...row, itemCount };
    });

    return runUpdate();
  }

  delete(id: number): number {
    const result = this.deleteStmt.run(id);
    return result.changes;
  }

  addItem(playlistId: number, libraryItemId: number): PlaylistItem {
    const runAddItem = this.db.transaction(() => {
      const { nextPosition } = this.nextPositionStmt.get(playlistId) as { nextPosition: number };

      const insertedRow = this.insertItemStmt.get(playlistId, libraryItemId, nextPosition) as {
        id: number;
        playlist_id: number;
        library_item_id: number;
        position: number;
      };

      return this.selectItemWithJoinStmt.get(insertedRow.id) as PlaylistItem;
    });

    return runAddItem();
  }

  removeItem(itemId: number): boolean {
    const runRemove = this.db.transaction(() => {
      const item = this.selectItemForRemoveStmt.get(itemId) as { playlist_id: number; position: number } | undefined;

      if (!item) return false;

      this.deleteItemStmt.run(itemId);
      this.compactPositionsStmt.run(item.playlist_id, item.position);
      return true;
    });

    return runRemove();
  }

  reorderItems(playlistId: number, itemIds: number[]): void {
    const reorder = this.db.transaction((ids: number[]) => {
      ids.forEach((id, index) => {
        this.updateItemPositionStmt.run(index, id);
      });
      this.updatePlaylistLastModifiedStmt.run(new Date().toISOString(), playlistId);
    });

    reorder(itemIds);
  }
}
