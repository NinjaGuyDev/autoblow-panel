import type { Request, Response, NextFunction } from 'express';
import { parseIdParam, parseQueryParamInt, requireStringQueryParam } from '../middleware/validation.js';
import type { ClimaxService } from '../services/climax.service.js';

export class AnalyticsController {
  constructor(private climaxService: ClimaxService) {}

  // === Climax Record Handlers ===

  getClimaxRecords = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionIdRaw = requireStringQueryParam(req.query.sessionId, 'sessionId');
      const libraryItemIdRaw = requireStringQueryParam(req.query.libraryItemId, 'libraryItemId');

      if (sessionIdRaw !== undefined) {
        const parsed = parseQueryParamInt(sessionIdRaw, 'sessionId');
        const records = this.climaxService.getClimaxRecordsBySession(parsed);
        res.json(records);
        return;
      }

      if (libraryItemIdRaw !== undefined) {
        const parsed = parseQueryParamInt(libraryItemIdRaw, 'libraryItemId');
        const records = this.climaxService.getClimaxRecordsByLibraryItem(parsed);
        res.json(records);
        return;
      }

      const records = this.climaxService.getAllClimaxRecords();
      res.json(records);
    } catch (error) {
      next(error);
    }
  };

  getClimaxRecordById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      const record = this.climaxService.getClimaxRecordById(id);
      res.json(record);
    } catch (error) {
      next(error);
    }
  };

  createClimaxRecord = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const record = this.climaxService.createClimaxRecord(req.body);
      res.status(201).json(record);
    } catch (error) {
      next(error);
    }
  };

  deleteClimaxRecord = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      this.climaxService.deleteClimaxRecord(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  // === Pause Event Handlers ===

  getPauseEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionIdRaw = requireStringQueryParam(req.query.sessionId, 'sessionId');
      const parsed = parseQueryParamInt(sessionIdRaw, 'sessionId');
      const events = this.climaxService.getPauseEventsBySession(parsed);
      res.json(events);
    } catch (error) {
      next(error);
    }
  };

  createPauseEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const event = this.climaxService.createPauseEvent(req.body);
      res.status(201).json(event);
    } catch (error) {
      next(error);
    }
  };

  resumePauseEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      const { resumedAt } = req.body;
      const event = this.climaxService.resumePauseEvent(
        id,
        resumedAt ?? new Date().toISOString()
      );
      res.json(event);
    } catch (error) {
      next(error);
    }
  };

  deletePauseEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;
      this.climaxService.deletePauseEvent(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  // === Analytics/Stats Handlers ===

  getClimaxCountByScript = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limitRaw = requireStringQueryParam(req.query.limit, 'limit');
      const limit = parseQueryParamInt(limitRaw, 'limit', 10);
      const counts = this.climaxService.getClimaxCountByScript(limit);
      res.json(counts);
    } catch (error) {
      next(error);
    }
  };

  getSessionPauseStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionIdRaw = requireStringQueryParam(req.query.sessionId, 'sessionId');
      const parsed = parseQueryParamInt(sessionIdRaw, 'sessionId');
      const stats = this.climaxService.getSessionPauseStats(parsed);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  };
}
