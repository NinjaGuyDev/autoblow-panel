import { Router } from 'express';
import type { DeviceController } from '../controllers/device.controller.js';

export function createDeviceRouter(controller: DeviceController): Router {
  const router = Router();

  // Connection lifecycle
  router.post('/connect', controller.connect);
  router.post('/disconnect', controller.disconnect);
  router.get('/status', controller.status);

  // Playback control
  router.post('/play', controller.play);
  router.post('/play/:id', controller.playById);
  router.post('/pause', controller.pause);
  router.post('/resume', controller.resume);
  router.post('/toggle-pause', controller.togglePause);
  router.post('/stop', controller.stop);

  return router;
}
