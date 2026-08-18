import type { Request, Response, NextFunction } from 'express';
import type { ScriptModService } from '../services/script-mod.service.js';
import type { ModGenerationService } from '../services/mod-generation.service.js';
import { parseIdParam } from '../middleware/validation.js';

export class ScriptModController {
  constructor(
    private service: ScriptModService,
    private generationService: ModGenerationService
  ) {}

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(this.service.getAllMods());
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      res.json(this.service.getModById(id));
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(201).json(this.service.createMod(req.body));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      res.json(this.service.updateMod(id, req.body));
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      this.service.deleteMod(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  generate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await this.generationService.generate(req.body));
    } catch (error) {
      next(error);
    }
  };
}
