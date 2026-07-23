import { MyRoutesScreen } from "@/features/cobros";

// DESIGN_SYSTEM.md §3.5 — raíz del portal cobrador: "Mis rutas" (un cobrador
// puede tener varias). El detalle de cada ruta (#15c) vive en /collector/routes/[id].
export default function CollectorRoutesPage() {
  return <MyRoutesScreen />;
}
