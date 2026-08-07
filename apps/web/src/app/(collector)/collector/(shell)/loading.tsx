import { SkeletonCardList } from "@/shared/ui/skeletons";

// El cobrador entra desde la calle, muchas veces con señal pobre: es la
// superficie donde más se ve este estado. Tarjetas con la forma real de una
// ruta/cliente, no un rectángulo.
export default function CollectorShellLoading() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <SkeletonCardList rows={3} />
    </div>
  );
}
