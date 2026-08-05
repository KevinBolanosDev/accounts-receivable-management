import { z } from "zod";

export const dashboardRouteSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  estadoDia: z.enum(["abierta", "cerrada"]),
  avanceDelDia: z.number(),
  totalCobradoHoy: z.number(),
});
export type DashboardRoute = z.infer<typeof dashboardRouteSchema>;

export const dashboardSummarySchema = z.object({
  totalCollectedToday: z.number(),
  activeCredits: z.number().int(),
  clientsInArrears: z.number().int(), // clientes con ≥1 crédito MORA
  openRoutes: z.number().int(), // rutas sin cierre hoy
  routesToday: dashboardRouteSchema.array(),
  weeklyCollections: z.array(z.object({ date: z.string(), total: z.number() })), // 7 puntos
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
