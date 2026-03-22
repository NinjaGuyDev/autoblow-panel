import type { Request, Response, NextFunction } from 'express';
import type { DeviceService } from '../services/device.service.js';
import { parseIdParam } from '../middleware/validation.js';

export class DeviceController {
  constructor(private service: DeviceService) {}

  connect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceKey } = req.body;
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
      const { actions } = req.body;
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
