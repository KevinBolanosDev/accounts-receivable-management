import { NotFoundState } from "@/shared/ui/error-state";

// Cubre las URLs del panel que no existen (una ruta vieja pegada de un chat,
// un id borrado que llega a `notFound()`). Distinto de `error.tsx`: acá no hay
// nada que reintentar, hay que volver a un lugar que sí existe.
export default function AdminShellNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <NotFoundState
        entity="esta página"
        description="La dirección no corresponde a ninguna sección del panel."
        backHref="/admin"
        backLabel="Ir al dashboard"
        className="max-w-md"
      />
    </div>
  );
}
