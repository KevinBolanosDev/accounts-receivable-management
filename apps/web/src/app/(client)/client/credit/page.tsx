import { ClientCreditsListScreen } from "@/features/client-portal";

// DESIGN_SYSTEM.md §5.2 (revisado) — "Mis créditos", pantalla nueva que
// antecede a `#21c` (ver `[id]/page.tsx`). La lógica de redirección por
// estado de sesión vive en `ClientGuard` (layout del route-group `(client)`).
export default function ClientCreditPage() {
  return <ClientCreditsListScreen />;
}
