import type { Request, Response, NextFunction } from 'express';
import type { PlaylistService } from '../services/playlist.service.js';
import type { CreatePlaylistRequest, UpdatePlaylistRequest, AddPlaylistItemRequest, ReorderPlaylistItemsRequest } from '../types/shared.js';

export class PlaylistController {
  constructor(private service: PlaylistService) {}

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const playlists = this.service.getAllPlaylists();
      res.json(playlists);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const playlist = this.service.getPlaylistById(id);
      res.json(playlist);
    } catch (error) {
      next(error);
    }
  };

  getItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const items = this.service.getPlaylistItems(id);
      res.json(items);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as CreatePlaylistRequest;
      const playlist = this.service.createPlaylist(data);
      res.status(201).json(playlist);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const data = req.body as UpdatePlaylistRequest;
      const playlist = this.service.updatePlaylist(id, data);
      res.json(playlist);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      this.service.deletePlaylist(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const { libraryItemId } = req.body as AddPlaylistItemRequest;
      const item = this.service.addItem(id, libraryItemId);
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  };

  removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const itemId = parseInt(req.params.itemId, 10);
      this.service.removeItem(itemId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  reorderItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const { itemIds } = req.body as ReorderPlaylistItemsRequest;
      this.service.reorderItems(id, itemIds);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
