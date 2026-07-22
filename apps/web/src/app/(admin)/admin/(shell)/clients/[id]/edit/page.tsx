import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

// El formulario de edición de cliente (pantalla 4c) se construye en la
// sub-fase 2.7.
export default function AdminEditClientPage() {
  return (
    <>
      <AdminPageHeader eyebrow="Clientes / Editar" title="Editar cliente" />
      <div className="p-4 sm:p-6">
        <p className="text-body text-muted-foreground max-w-md">
          El formulario de edición de cliente (con captura de foto del documento) llega en la
          sub-fase 2.7.
        </p>
      </div>
    </>
  );
}
