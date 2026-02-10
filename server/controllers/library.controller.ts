import type { Request, Response, NextFunction } from 'express';
import type { LibraryService } from '../services/library.service.js';
import type { CreateLibraryItemRequest, SearchQuery, MigrationRequest } from '../types/shared.js';
import { parseIdParam } from '../middleware/validation.js';

export class LibraryController {
  constructor(private service: LibraryService) {}

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = this.service.getAllItems();
      res.json(items);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      const item = this.service.getItemById(id);
      res.json(item);
    } catch (error) {
      next(error);
    }
  };

  search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { q } = req.query as SearchQuery;
      const items = this.service.searchItems(q || '');
      res.json(items);
    } catch (error) {
      next(error);
    }
  };

  getCustomPatterns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = this.service.getCustomPatterns();
      res.json(items);
    } catch (error) {
      next(error);
    }
  };

  updateCustomPattern = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      const data = req.body as Partial<CreateLibraryItemRequest>;
      const item = this.service.updateCustomPattern(id, data);
      res.json(item);
    } catch (error) {
      next(error);
    }
  };

  softDeleteCustomPattern = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      this.service.softDeleteCustomPattern(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as CreateLibraryItemRequest;
      const item = this.service.createItem(data);
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      this.service.deleteItem(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  save = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as CreateLibraryItemRequest;
      const item = this.service.saveOrUpdateItem(data);
      res.json(item);
    } catch (error) {
      next(error);
    }
  };

  getMigrationStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const migrated = this.service.getMigrationStatus();
      res.json({ migrated });
    } catch (error) {
      next(error);
    }
  };

  migrate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { data } = req.body as MigrationRequest;
      this.service.migrateFromIndexedDB(data);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };
}
