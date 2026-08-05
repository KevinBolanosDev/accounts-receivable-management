import { dashboardSummarySchema, type DashboardSummary } from "@repo/types";

import { useSessionStore } from "@/entities/session";
import { apiFetch } from "@/shared/api/client";

export interface DashboardService {
  getSummary(): Promise<DashboardSummary>;
}

const delay = (ms = 320) => new Promise((resolve) => setTimeout(resolve, ms));

// "YYYY-MM-DD" en horario local del navegador — coherente con cómo el mock
// arma sus propias fechas relativas a "hoy". El backend (5.9) las devuelve
// ancladas a `America/Bogota`; acá alcanza con una fecha de calendario.
function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

// Mock coherente con las rutas demo de `routes-collectors` (r1..r6) y sus
// nombres, para que el Dashboard y "Rutas del día" cuenten la misma historia.
const MOCK_SUMMARY: DashboardSummary = {
  totalCollectedToday: 2_480_000,
  activeCredits: 142,
  clientsInArrears: 18,
  openRoutes: 3,
  routesToday: [
    { id: "r3", nombre: "Ruta 3 · Centro", estadoDia: "abierta", avanceDelDia: 82, totalCobradoHoy: 680_000 },
    { id: "r1", nombre: "Ruta 1 · Norte", estadoDia: "cerrada", avanceDelDia: 100, totalCobradoHoy: 840_000 },
    { id: "r2", nombre: "Ruta 2 · Sur", estadoDia: "abierta", avanceDelDia: 64, totalCobradoHoy: 410_000 },
    { id: "r4", nombre: "Ruta 4 · Occidente", estadoDia: "abierta", avanceDelDia: 41, totalCobradoHoy: 300_000 },
    { id: "r5", nombre: "Ruta 5 · Oriente", estadoDia: "abierta", avanceDelDia: 30, totalCobradoHoy: 180_000 },
  ],
  weeklyCollections: [
    { date: isoDaysAgo(6), total: 1_920_000 },
    { date: isoDaysAgo(5), total: 2_150_000 },
    { date: isoDaysAgo(4), total: 1_780_000 },
    { date: isoDaysAgo(3), total: 2_640_000 },
    { date: isoDaysAgo(2), total: 2_410_000 },
    { date: isoDaysAgo(1), total: 1_320_000 },
    { date: isoDaysAgo(0), total: 2_480_000 },
  ],
};

export const mockDashboardService: DashboardService = {
  async getSummary() {
    await delay();
    return dashboardSummarySchema.parse(MOCK_SUMMARY);
  },
};

export const httpDashboardService: DashboardService = {
  getSummary() {
    return apiFetch("/dashboard/summary", dashboardSummarySchema, {
      token: useSessionStore.getState().token,
    });
  },
};

// Backend en 5.9 (agregaciones Prisma); el swap a `httpDashboardService` llega
// en 5.10, junto con `closuresService`.
export const dashboardService: DashboardService = mockDashboardService;
