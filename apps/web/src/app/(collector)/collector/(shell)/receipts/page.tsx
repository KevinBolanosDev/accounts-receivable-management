import { ReceiptIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { CollectorHero } from "@/widgets/collector-shell/CollectorHero";

// La pestaña "Recibos" existe en `nav-items.ts` desde la Fase 2, pero esta
// ruta NO tenía `page.tsx` — solo `[pagoId]`. Tocarla daba un **404 real**:
// la pestaña de la barra inferior expulsaba al cobrador de la app.
//
// Listar los recibos del cobrador necesita un endpoint que todavía no existe
// (`GET /payments` scoped por cobrador). Hasta entonces, un vacío que explica
// dónde SÍ están los recibos es infinitamente mejor que un 404: el recibo de
// cada pago se abre desde el historial del crédito, y esta pantalla lo dice.
export default function CollectorReceiptsPage() {
  return (
    <div className="flex flex-col pb-6">
      <CollectorHero title="Recibos" subtitle="Comprobantes de tus cobros" overlap={false} />

      <div className="px-4 pt-5">
        <EmptyState
          icon={<ReceiptIcon />}
          title="El listado de recibos todavía no está disponible"
          description="Mientras tanto, cada recibo se abre desde el historial del crédito del cliente: entrá al cliente, abrí su crédito y tocá el pago."
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href="/collector/clients">Ir a mis clientes</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
