import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";

// Clientes del cobrador. La lista de su ruta llega en la Fase 3; aquí se
// estrena el alta de cliente en campo (pantalla 17c).
export default function CollectorClientsPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-h2">Clientes</h1>
      <Button asChild size="lg" className="w-full">
        <Link href="/collector/clients/new">
          <PlusIcon />
          Nuevo cliente
        </Link>
      </Button>
      <p className="text-body-sm text-muted-foreground">
        La lista de clientes de tu ruta llega en la Fase 3.
      </p>
    </div>
  );
}
