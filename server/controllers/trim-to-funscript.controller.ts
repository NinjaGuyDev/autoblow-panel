import type { Request, Response, NextFunction } from 'express';
import type { TrimToFunscriptService } from '../services/trim-to-funscript.service.js';
import type { TrimToFunscriptRequest } from '../types/shared.js';

export class TrimToFunscriptController {
  constructor(private service: TrimToFunscriptService) {}

  /**
   * POST /api/media/trim-to-funscript — cut the video's lead-up to its script
   * and save the result as a new library item
   */
  trim = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.trim(req.body as TrimToFunscriptRequest);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };
}
