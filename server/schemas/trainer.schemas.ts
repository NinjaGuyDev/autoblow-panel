import { z } from 'zod';
import { TRAINER_RANK_MAX, TRAINER_RANK_MIN } from '../types/shared.js';

export const CreateTrainerRankingSchema = z.object({
  rank: z.number().int().min(TRAINER_RANK_MIN).max(TRAINER_RANK_MAX),
});
