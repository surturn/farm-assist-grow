import { z } from "zod";

export const createCropSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    status: z.enum(["PLANNED", "GROWING", "HARVESTED"]),
  }),
  params: z.object({ farmId: z.string().cuid() }),
  query: z.object({}),
});
