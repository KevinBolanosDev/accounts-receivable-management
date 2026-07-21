import { z } from "zod";

export const healthStatusSchema = z.object({
  status: z.literal("ok"),
  uptime: z.number(),
  timestamp: z.string(),
  database: z.enum(["up", "down"]).optional(),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;
