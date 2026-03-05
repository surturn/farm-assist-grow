import { z } from "zod";

export const createFarmSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    location: z.string().optional(),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const farmIdSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({ farmId: z.string().cuid() }),
  query: z.object({}),
});
