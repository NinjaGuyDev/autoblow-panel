import type { Request, Response, NextFunction } from 'express';
import type { SessionService } from '../services/session.service.js';
import { parseIdParam, parseQueryParamInt, requireStringQueryParam } from '../middleware/validation.js';

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
      const session = this.service.createSession(req.body);
      res.status(201).json(session);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      const session = this.service.updateSession(id, req.body);
      res.json(session);
    } catch (error) {
      next(error);
    }
  };

  appendScript = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      const { libraryItemId, timestamp } = req.body;
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
      const { endedAt } = req.body;
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
      const limitRaw = requireStringQueryParam(req.query.limit, 'limit');
      const limit = parseQueryParamInt(limitRaw, 'limit', 10);
      const mostPlayed = this.service.getMostPlayed(limit);
      res.json(mostPlayed);
    } catch (error) {
      next(error);
    }
  };
}
