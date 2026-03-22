import { z } from 'zod';

export const CreatePlaylistSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

export const UpdatePlaylistSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

export const AddPlaylistItemSchema = z.object({
  libraryItemId: z.number().int().positive(),
});

export const ReorderPlaylistItemsSchema = z.object({
  itemIds: z.array(z.number().int().positive()).min(1),
});
