import { Router } from 'express';
import type { DeviceController } from '../controllers/device.controller.js';
import { validateBody } from '../middleware/validate-body.js';
import { DeviceConnectSchema, DevicePlaySchema } from '../schemas/device.schemas.js';

export function createDeviceRouter(controller: DeviceController): Router {
  const router = Router();

  // Connection lifecycle
  router.post('/connect', validateBody(DeviceConnectSchema), controller.connect);
  router.post('/disconnect', controller.disconnect);
  router.get('/status', controller.status);

  // Playback control
  router.post('/play', validateBody(DevicePlaySchema), controller.play);
  router.post('/play/:id', controller.playById);
  router.post('/pause', controller.pause);
  router.post('/resume', controller.resume);
  router.post('/toggle-pause', controller.togglePause);
  router.post('/stop', controller.stop);

  return router;
}
