import type { Request, Response, NextFunction } from 'express';
import type { PlaylistService } from '../services/playlist.service.js';
import { parseIdParam } from '../middleware/validation.js';

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
      const id = parseIdParam(req, res);
      if (id === null) return;
      const playlist = this.service.getPlaylistById(id);
      res.json(playlist);
    } catch (error) {
      next(error);
    }
  };

  getItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      const items = this.service.getPlaylistItems(id);
      res.json(items);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const playlist = this.service.createPlaylist(req.body);
      res.status(201).json(playlist);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      const playlist = this.service.updatePlaylist(id, req.body);
      res.json(playlist);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      this.service.deletePlaylist(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      const { libraryItemId } = req.body;
      const item = this.service.addItem(id, libraryItemId);
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  };

  removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const itemId = parseIdParam(req, res, 'itemId');
      if (itemId === null) return;
      this.service.removeItem(itemId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  reorderItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      const { itemIds } = req.body;
      this.service.reorderItems(id, itemIds);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
