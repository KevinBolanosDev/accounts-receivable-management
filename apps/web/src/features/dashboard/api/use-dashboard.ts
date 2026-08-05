"use client";

import { useQuery } from "@tanstack/react-query";

import { dashboardService } from "./dashboard-service";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: ["dashboard", "summary"] as const,
};

export function useDashboardSummary() {
  return useQuery({ queryKey: dashboardKeys.summary, queryFn: () => dashboardService.getSummary() });
}
