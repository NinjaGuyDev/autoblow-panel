import type { Request, Response, NextFunction } from 'express';
import type { DeviceService } from '../services/device.service.js';
import type { DeviceConnectRequest, DevicePlayRequest } from '../types/shared.js';
import { parseIdParam } from '../middleware/validation.js';

export class DeviceController {
  constructor(private service: DeviceService) {}

  connect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceKey } = req.body as DeviceConnectRequest;
      if (!deviceKey || typeof deviceKey !== 'string') {
        res.status(400).json({ error: 'deviceKey is required and must be a string' });
        return;
      }

      const result = await this.service.connect(deviceKey);
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Device connection failed')) {
        res.status(502).json({ error: error.message });
        return;
      }
      next(error);
    }
  };

  disconnect = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.disconnect();
      res.json({ status: 'disconnected' });
    } catch (error) {
      next(error);
    }
  };

  status = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(this.service.getStatus());
    } catch (error) {
      next(error);
    }
  };

  play = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { actions } = req.body as DevicePlayRequest;
      const validationError = validateActions(actions);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const result = await this.service.play(actions);
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'No device connected') {
        res.status(409).json({ error: error.message });
        return;
      }
      next(error);
    }
  };

  playById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req, res);
      if (id === null) return;

      const result = await this.service.playById(id);
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'No device connected') {
        res.status(409).json({ error: error.message });
        return;
      }
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  };

  pause = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.pause();
      res.json({ status: 'paused' });
    } catch (error) {
      next(error);
    }
  };

  resume = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.resume();
      res.json({ status: 'resumed' });
    } catch (error) {
      next(error);
    }
  };

  togglePause = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.togglePause();
      res.json({ status: result });
    } catch (error) {
      next(error);
    }
  };

  stop = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.stop();
      res.json({ status: 'stopped' });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Validate funscript actions array.
 * Returns an error message string, or null if valid.
 */
function validateActions(actions: unknown): string | null {
  if (!Array.isArray(actions) || actions.length === 0) {
    return 'actions must be a non-empty array';
  }

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    if (typeof action !== 'object' || action === null) {
      return `actions[${i}] must be an object with pos and at`;
    }
    if (typeof action.pos !== 'number' || action.pos < 0 || action.pos > 100) {
      return `actions[${i}].pos must be a number between 0 and 100`;
    }
    if (typeof action.at !== 'number' || action.at < 0) {
      return `actions[${i}].at must be a non-negative number`;
    }
    if (i > 0 && action.at < actions[i - 1].at) {
      return `actions must be sorted by 'at' ascending — actions[${i}].at (${action.at}) < actions[${i - 1}].at (${actions[i - 1].at})`;
    }
  }

  return null;
}
