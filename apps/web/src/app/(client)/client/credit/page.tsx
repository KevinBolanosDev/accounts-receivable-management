import { ClientCreditScreen } from "@/features/client-portal";

// DESIGN_SYSTEM.md §5.2 — pantalla #21c. La lógica de redirección por estado
// de sesión vive en `ClientGuard` (layout del route-group `(client)`).
export default function ClientCreditPage() {
  return <ClientCreditScreen />;
}