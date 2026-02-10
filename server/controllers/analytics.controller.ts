import type { Request, Response, NextFunction } from 'express';
import { parseIdParam } from '../middleware/validation.js';
import type { ClimaxService } from '../services/climax.service.js';
import type { CreateClimaxRecordRequest, CreatePauseEventRequest } from '../types/shared.js';

export class AnalyticsController {
  constructor(private climaxService: ClimaxService) {}

  // === Climax Record Handlers ===

  getClimaxRecords = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId, libraryItemId } = req.query;

      if (sessionId) {
        const parsed = parseInt(sessionId as string, 10);
        if (!Number.isInteger(parsed)) {
          res.status(400).json({ error: 'sessionId must be a valid integer' });
          return;
        }
        const records = this.climaxService.getClimaxRecordsBySession(parsed);
        res.json(records);
        return;
      }

      if (libraryItemId) {
        const parsed = parseInt(libraryItemId as string, 10);
        if (!Number.isInteger(parsed)) {
          res.status(400).json({ error: 'libraryItemId must be a valid integer' });
          return;
        }
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
      const data = req.body as CreateClimaxRecordRequest;
      const record = this.climaxService.createClimaxRecord(data);
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
      const { sessionId } = req.query;

      if (!sessionId) {
        res.status(400).json({ error: 'sessionId query parameter is required' });
        return;
      }

      const parsed = parseInt(sessionId as string, 10);
      if (!Number.isInteger(parsed)) {
        res.status(400).json({ error: 'sessionId must be a valid integer' });
        return;
      }

      const events = this.climaxService.getPauseEventsBySession(parsed);
      res.json(events);
    } catch (error) {
      next(error);
    }
  };

  createPauseEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as CreatePauseEventRequest;
      const event = this.climaxService.createPauseEvent(data);
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
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      if (!Number.isInteger(limit)) {
        res.status(400).json({ error: 'limit must be a valid integer' });
        return;
      }
      const counts = this.climaxService.getClimaxCountByScript(limit);
      res.json(counts);
    } catch (error) {
      next(error);
    }
  };

  getSessionPauseStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = req.query;

      if (!sessionId) {
        res.status(400).json({ error: 'sessionId query parameter is required' });
        return;
      }

      const parsed = parseInt(sessionId as string, 10);
      if (!Number.isInteger(parsed)) {
        res.status(400).json({ error: 'sessionId must be a valid integer' });
        return;
      }

      const stats = this.climaxService.getSessionPauseStats(parsed);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  };
}
