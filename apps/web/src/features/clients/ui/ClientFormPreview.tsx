"use client";

import type { ClienteDetail } from "@repo/types";

import { ClientContactPanel, ESTADO_CLIENTE_LABEL } from "@/entities/client";
import { CreditCard, saldoPendienteDeCreditos } from "@/entities/credit";
import { formatPhone } from "@/shared/lib/phone";
import { formatCurrency } from "@/shared/lib/format-currency";
import { getInitials } from "@/shared/lib/initials";
import { Badge } from "@/shared/ui/badge";
import { ProgressRing } from "@/shared/ui/progress-ring";

interface PreviewValues {
  nombre?: string | undefined;
  documento?: string | undefined;
  telefono?: string | undefined;
  direccion?: string | undefined;
  contactoNombre?: string | null | undefined;
  contactoTelefono?: string | null | undefined;
  abrirCredito?: boolean | undefined;
}

interface ClientFormPreviewProps {
  /** Lo que el usuario está escribiendo ahora mismo. */
  values: PreviewValues;
  rutaNombre: string;
  /** Solo en edición. Su ausencia es lo que distingue alta de edición. */
  cliente?: ClienteDetail | null;
}

function PreviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium tabular-nums">{children}</span>
    </div>
  );
}

/**
 * Vista previa del formulario de cliente.
 *
 * Regla que gobierna qué se muestra de dónde:
 *   · **Campos editables → `values`**, para que reaccionen al tipeo.
 *   · **Datos derivados del backend → `cliente`**, porque no se editan aquí.
 *
 * En ALTA no hay `cliente`, así que el avance en 0 y "Sin crédito aún" son
 * correctos: es una proyección de lo que se va a crear. En EDICIÓN esos mismos
 * valores estaban HARDCODEADOS, de modo que un cliente con crédito activo al
 * 60% se mostraba en 0% y "Sin crédito aún" — la pantalla mentía.
 */
export function ClientFormPreview({ values, rutaNombre, cliente }: ClientFormPreviewProps) {
  const isEdit = !!cliente;
  const creditoActivo = cliente?.creditosActivos[0];
  const saldo = cliente ? saldoPendienteDeCreditos(cliente.creditosActivos) : 0;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-muted-foreground uppercase">Vista previa</p>

      <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
          {getInitials(values.nombre || "?")}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">{values.nombre || "Nombre del cliente"}</span>
          <span className="truncate text-caption text-muted-foreground">{rutaNombre}</span>
        </div>
        <ProgressRing value={cliente?.porcentajePagado ?? 0} size="md" showLabel={false} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <PreviewRow label="Estado">
          {cliente?.estado ? (
            <Badge status={cliente.estado}>{ESTADO_CLIENTE_LABEL[cliente.estado]}</Badge>
          ) : (
            <Badge status="ruta-cerrada">Sin crédito aún</Badge>
          )}
        </PreviewRow>
        <PreviewRow label="Documento">{values.documento || "—"}</PreviewRow>
        <PreviewRow label="Teléfono">{formatPhone(values.telefono) || "—"}</PreviewRow>

        {isEdit ? (
          <>
            <PreviewRow label="Créditos activos">{cliente.creditosActivos.length}</PreviewRow>
            <PreviewRow label="Saldo pendiente">{formatCurrency(saldo)}</PreviewRow>
          </>
        ) : (
          // Solo tiene sentido en el alta: en edición el bloque de crédito ni
          // se renderiza, así que la fila decía "No" siempre.
          <PreviewRow label="Crédito al guardar">
            {values.abrirCredito ? "Se creará tras guardar" : "No"}
          </PreviewRow>
        )}
      </div>

      {creditoActivo ? (
        <CreditCard credito={creditoActivo} density="compact" />
      ) : null}

      {/* Refleja lo que se está escribiendo, no lo guardado: es la forma de
          revisar el contacto de referencia antes de dar a guardar. */}
      <ClientContactPanel
        cliente={{
          documento: values.documento || null,
          telefono: values.telefono || null,
          direccion: values.direccion || null,
          contactoNombre: values.contactoNombre || null,
          contactoTelefono: values.contactoTelefono || null,
        }}
        columns={1}
      />
    </div>
  );
}
