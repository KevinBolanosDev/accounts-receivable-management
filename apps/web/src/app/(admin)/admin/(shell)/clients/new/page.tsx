import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

// El formulario de alta de cliente (pantalla 4c, con uploader de foto) se
// construye en la sub-fase 2.7.
export default function AdminNewClientPage() {
  return (
    <>
      <AdminPageHeader eyebrow="Clientes / Nuevo" title="Nuevo cliente" />
      <div className="p-4 sm:p-6">
        <p className="text-body text-muted-foreground max-w-md">
          El formulario de alta de cliente (con captura de foto del documento) llega en la sub-fase
          2.7.
        </p>
      </div>
    </>
  );
}
