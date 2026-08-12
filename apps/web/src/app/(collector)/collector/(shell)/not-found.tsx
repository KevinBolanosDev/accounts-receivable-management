import { NotFoundState } from "@/shared/ui/error-state";

export default function CollectorShellNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <NotFoundState
        entity="esta página"
        description="Puede que la ruta o el cliente ya no estén asignados a vos."
        backHref="/collector"
        backLabel="Ir a mis rutas"
        className="w-full max-w-sm"
      />
    </div>
  );
}
