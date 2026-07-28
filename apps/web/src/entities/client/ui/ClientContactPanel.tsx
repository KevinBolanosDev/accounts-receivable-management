import * as React from "react";
import { IdCardIcon, MapPinIcon, PhoneIcon, UserRoundIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { DataField, DataFieldList } from "@/shared/ui/data-field";

interface ClientContactPanelProps extends React.ComponentProps<"div"> {
  // `Pick` estructural en vez de `ClienteDetail`: así también acepta un
  // `RutaCliente` o un borrador de formulario sin castear.
  cliente: {
    documento?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    contactoNombre?: string | null;
    contactoTelefono?: string | null;
  };
  columns?: 1 | 2;
  /** Oculta el bloque de contacto adicional si no hay ninguno de los dos campos. */
  hideEmptyContact?: boolean;
}

/**
 * Datos de contacto del cliente, con opción de copiar y de llamar.
 * Es lo que el cobrador necesita a mano cuando está parado en la puerta.
 */
export function ClientContactPanel({
  cliente,
  columns = 2,
  hideEmptyContact = true,
  className,
  ...props
}: ClientContactPanelProps) {
  const tieneContactoAdicional = Boolean(cliente.contactoNombre || cliente.contactoTelefono);

  return (
    <div
      data-slot="client-contact-panel"
      className={cn("rounded-xl border border-border bg-card p-4", className)}
      {...props}
    >
      <DataFieldList columns={columns}>
        <DataField
          label="Documento"
          value={cliente.documento}
          icon={<IdCardIcon className="size-3.5" />}
          copyValue={cliente.documento}
        />
        <DataField
          label="Teléfono"
          value={cliente.telefono}
          icon={<PhoneIcon className="size-3.5" />}
          copyValue={cliente.telefono}
          href={cliente.telefono ? `tel:${cliente.telefono}` : undefined}
        />
        <DataField
          label="Ubicación"
          value={cliente.direccion}
          icon={<MapPinIcon className="size-3.5" />}
          copyValue={cliente.direccion}
          className={columns === 2 ? "sm:col-span-2" : undefined}
        />

        {tieneContactoAdicional || !hideEmptyContact ? (
          <>
            <DataField
              label="Contacto adicional"
              value={cliente.contactoNombre}
              icon={<UserRoundIcon className="size-3.5" />}
              copyValue={cliente.contactoNombre}
            />
            <DataField
              label="Teléfono del contacto"
              value={cliente.contactoTelefono}
              icon={<PhoneIcon className="size-3.5" />}
              copyValue={cliente.contactoTelefono}
              href={cliente.contactoTelefono ? `tel:${cliente.contactoTelefono}` : undefined}
            />
          </>
        ) : null}
      </DataFieldList>
    </div>
  );
}
