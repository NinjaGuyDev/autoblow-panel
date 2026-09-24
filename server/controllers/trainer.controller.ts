import type { Request, Response, NextFunction } from 'express';
import type { TrainerService } from '../services/trainer.service.js';
import type { CreateTrainerRankingRequest } from '../types/shared.js';
import { parseIdParam } from '../middleware/validation.js';

export class TrainerController {
  constructor(private service: TrainerService) {}

  getPatterns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(this.service.getAllPatterns());
    } catch (error) {
      next(error);
    }
  };

  rankPattern = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      const { rank } = req.body as CreateTrainerRankingRequest;
      res.status(201).json(this.service.rankPattern(id, rank));
    } catch (error) {
      next(error);
    }
  };
}
