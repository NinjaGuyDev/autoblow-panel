import type { Request, Response, NextFunction } from 'express';
import type { SessionService } from '../services/session.service.js';
import type { CreateSessionRequest, UpdateSessionRequest } from '../types/shared.js';
import { parseIdParam } from '../middleware/validation.js';

export class SessionController {
  constructor(private service: SessionService) {}

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessions = this.service.getAllSessions();
      res.json(sessions);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      const session = this.service.getSessionById(id);
      res.json(session);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as CreateSessionRequest;
      const session = this.service.createSession(data);
      res.status(201).json(session);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      const data = req.body as UpdateSessionRequest;
      const session = this.service.updateSession(id, data);
      res.json(session);
    } catch (error) {
      next(error);
    }
  };

  appendScript = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      const { libraryItemId, timestamp } = req.body as { libraryItemId: number; timestamp: string };
      const session = this.service.appendScriptToSession(id, libraryItemId, timestamp);
      res.json(session);
    } catch (error) {
      next(error);
    }
  };

  end = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      const { endedAt } = req.body as { endedAt?: string };
      const finalEndedAt = endedAt ?? new Date().toISOString();
      const session = this.service.endSession(id, finalEndedAt);
      res.json(session);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      this.service.deleteSession(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = this.service.getStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  };

  getMostPlayed = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      if (!Number.isInteger(limit)) {
        res.status(400).json({ error: 'limit must be a valid integer' });
        return;
      }
      const mostPlayed = this.service.getMostPlayed(limit);
      res.json(mostPlayed);
    } catch (error) {
      next(error);
    }
  };
}
