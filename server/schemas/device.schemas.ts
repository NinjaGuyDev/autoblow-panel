import { z } from 'zod';

const FunscriptActionSchema = z.object({
  pos: z.number().min(0).max(100),
  at: z.number().min(0),
});

export const DeviceConnectSchema = z.object({
  deviceKey: z.string().min(1),
});

export const DevicePlaySchema = z.object({
  actions: z.array(FunscriptActionSchema).min(1),
}).refine(
  (data) => data.actions.every((a, i) => i === 0 || a.at >= data.actions[i - 1].at),
  { message: "actions must be sorted by 'at' ascending", path: ['actions'] },
);
