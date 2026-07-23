"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  createClienteRequestSchema,
  type CreateClienteRequest,
} from "@repo/types";
import { toast } from "sonner";
import { ChevronsUpDownIcon } from "lucide-react";

import { getInitials } from "@/shared/lib/initials";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ProgressRing } from "@/shared/ui/progress-ring";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

import { useRutas } from "@/features/routes-collectors/api/use-rutas";
import { useProductos } from "@/features/productos/api/use-productos";
import { useCreateCredito } from "@/features/creditos/api/use-creditos";

import { useCliente, useCreateCliente, useUpdateCliente } from "../api/use-clientes";
import { DocumentUploader } from "./DocumentUploader";

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-body-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PreviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium tabular-nums">{children}</span>
    </div>
  );
}

interface CreditoOpcional {
  abrirCredito: boolean;
  productoId: string;
  montoTotal?: number | undefined;
  cuotaDiaria?: number | undefined;
}

type FormValues = CreateClienteRequest & CreditoOpcional;

const DEFAULTS: FormValues = {
  nombre: "",
  telefono: "",
  documento: "",
  direccion: "",
  rutaId: "",
  fotoDocumentoFrenteUrl: null,
  fotoDocumentoReversoUrl: null,
  abrirCredito: false,
  productoId: "",
  montoTotal: undefined,
  cuotaDiaria: undefined,
};

export function ClientFormScreen({ clienteId }: { clienteId?: string }) {
  const isEdit = !!clienteId;
  const router = useRouter();
  const { data: cliente } = useCliente(clienteId ?? "");
  const { data: rutas = [] } = useRutas();
  const { data: productos = [] } = useProductos();
  const createCliente = useCreateCliente();
  const updateCliente = useUpdateCliente(clienteId ?? "");
  const createCredito = useCreateCredito();

  const form = useForm<FormValues>({
    resolver: zodResolver(createClienteRequestSchema) as never,
    mode: "onBlur",
    defaultValues: DEFAULTS,
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
    setError,
  } = form;

  const abrirCredito = watch("abrirCredito");
  const values = watch();
  const rutaNombre =
    rutas.find((route) => route.id === values.rutaId)?.nombre ?? "Sin ruta";

  async function onSubmit(v: FormValues) {
    // Validación inline del bloque opcional (sub-fase 3.4). RHF no entiende
    // campos cruzados en este formulario único sin un esquema ampliado, así
    // que validamos a mano antes de salir.
    if (!isEdit && v.abrirCredito) {
      const fieldErrors: Array<{ name: keyof CreditoOpcional; message: string }> = [];
      if (!v.productoId) fieldErrors.push({ name: "productoId", message: "Selecciona un producto." });
      if (typeof v.montoTotal !== "number" || v.montoTotal <= 0) {
        fieldErrors.push({ name: "montoTotal", message: "El monto total debe ser mayor a 0." });
      }
      if (typeof v.cuotaDiaria !== "number" || v.cuotaDiaria <= 0) {
        fieldErrors.push({
          name: "cuotaDiaria",
          message: "La cuota diaria debe ser mayor a 0.",
        });
      }
      if (fieldErrors.length > 0) {
        for (const err of fieldErrors) {
          setError(err.name, { type: "manual", message: err.message });
        }
        return;
      }
    }

    try {
      if (isEdit) {
        await updateCliente.mutateAsync({
          nombre: v.nombre,
          telefono: v.telefono,
          documento: v.documento,
          direccion: v.direccion,
          rutaId: v.rutaId,
          fotoDocumentoFrenteUrl: v.fotoDocumentoFrenteUrl ?? null,
          fotoDocumentoReversoUrl: v.fotoDocumentoReversoUrl ?? null,
        });
        toast.success("Cliente actualizado");
        router.push(`/admin/clients/${clienteId}`);
        return;
      }

      const clienteCreado = await createCliente.mutateAsync({
        nombre: v.nombre,
        telefono: v.telefono,
        documento: v.documento,
        direccion: v.direccion,
        rutaId: v.rutaId,
        fotoDocumentoFrenteUrl: v.fotoDocumentoFrenteUrl ?? null,
        fotoDocumentoReversoUrl: v.fotoDocumentoReversoUrl ?? null,
      });

      if (
        v.abrirCredito &&
        v.productoId &&
        typeof v.montoTotal === "number" &&
        typeof v.cuotaDiaria === "number"
      ) {
        try {
          await createCredito.mutateAsync({
            clienteId: clienteCreado.id,
            productoId: v.productoId,
            montoTotal: v.montoTotal,
            cuotaDiaria: v.cuotaDiaria,
          });
          toast.success("Cliente y crédito creados");
        } catch {
          toast.error(
            `Cliente creado (${clienteCreado.id}); el crédito no se guardó — puedes crearlo desde su detalle.`,
          );
        }
      } else {
        toast.success("Cliente creado");
      }
      router.push(`/admin/clients/${clienteCreado.id}`);
    } catch {
      toast.error("No se pudo guardar el cliente");
    }
  }

  const saving =
    createCliente.isPending || updateCliente.isPending || createCredito.isPending;

  return (
    <>
      <AdminPageHeader
        eyebrow={
          isEdit
            ? `Clientes / ${cliente?.nombre ?? "Cliente"} · Editar`
            : "Clientes / Nuevo"
        }
        title={isEdit ? "Editar cliente" : "Nuevo cliente"}
      />

      <form
        onSubmit={handleSubmit(onSubmit as never)}
        className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px]"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
            <p className="text-caption text-muted-foreground uppercase">Datos personales</p>

            <Field id="nombre" label="Nombre completo" error={errors.nombre?.message}>
              <Input id="nombre" placeholder="Ej. María Fernández" {...register("nombre")} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="telefono" label="Teléfono" error={errors.telefono?.message}>
                <Input id="telefono" placeholder="300 123 4567" {...register("telefono")} />
              </Field>
              <Field id="documento" label="Documento" error={errors.documento?.message}>
                <Input id="documento" placeholder="1.020.456.789" {...register("documento")} />
              </Field>
            </div>

            <Field id="direccion" label="Dirección" error={errors.direccion?.message}>
              <Input
                id="direccion"
                placeholder="Cra 12 #34-56, Centro"
                {...register("direccion")}
              />
            </Field>

            <Field id="ruta" label="Ruta asignada" error={errors.rutaId?.message}>
              <Controller
                control={control}
                name="rutaId"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger id="ruta" className="w-full">
                      <SelectValue placeholder="Selecciona una ruta" />
                    </SelectTrigger>
                    <SelectContent>
                      {rutas.map((route) => (
                        <SelectItem key={route.id} value={route.id}>
                          {route.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <div className="flex flex-col gap-2">
              <Label>Foto del documento</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <DocumentUploader
                  placeholder="Frente"
                  value={values.fotoDocumentoFrenteUrl ?? null}
                  onChange={(url) => setValue("fotoDocumentoFrenteUrl", url)}
                />
                <DocumentUploader
                  placeholder="Reverso"
                  value={values.fotoDocumentoReversoUrl ?? null}
                  onChange={(url) => setValue("fotoDocumentoReversoUrl", url)}
                />
              </div>
            </div>
          </div>

          {/* === Sub-fase 3.4 — bloque "Agregar crédito" opcional ============ */}
          {!isEdit ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col">
                  <p className="text-caption text-muted-foreground uppercase">
                    Crédito (opcional)
                  </p>
                  <p className="text-body-sm text-muted-foreground">
                    Puedes crear el crédito ahora o después desde el detalle del cliente.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setValue("abrirCredito", !abrirCredito)}
                  aria-expanded={abrirCredito}
                >
                  <ChevronsUpDownIcon />
                  {abrirCredito ? "Ocultar bloque" : "Agregar crédito"}
                </Button>
              </div>

              {abrirCredito ? (
                <div className="flex flex-col gap-4 border-t border-border pt-4">
                  <Field
                    id="credito-producto"
                    label="Producto"
                    error={errors.productoId?.message}
                  >
                    <Select
                      value={values.productoId || undefined}
                      onValueChange={(v) =>
                        setValue("productoId", v, { shouldValidate: true })
                      }
                    >
                      <SelectTrigger id="credito-producto" className="w-full">
                        <SelectValue placeholder="Selecciona un producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {productos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nombre} · {formatCurrency(p.precioBase)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      id="credito-monto"
                      label="Monto total"
                      error={errors.montoTotal?.message}
                    >
                      <Input
                        id="credito-monto"
                        type="number"
                        min={0}
                        inputMode="numeric"
                        placeholder="1500000"
                        {...register("montoTotal", { valueAsNumber: true })}
                      />
                    </Field>
                    <Field
                      id="credito-cuota"
                      label="Cuota diaria"
                      error={errors.cuotaDiaria?.message}
                    >
                      <Input
                        id="credito-cuota"
                        type="number"
                        min={0}
                        inputMode="numeric"
                        placeholder="25000"
                        {...register("cuotaDiaria", { valueAsNumber: true })}
                      />
                    </Field>
                  </div>

                  <CuotasEstimadasInline
                    monto={Number(values.montoTotal ?? 0)}
                    cuota={Number(values.cuotaDiaria ?? 0)}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {isEdit ? "Guardar cambios" : "Guardar cliente"}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-caption text-muted-foreground uppercase">Vista previa</p>

          <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
              {getInitials(values.nombre || "?")}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">
                {values.nombre || "Nombre del cliente"}
              </span>
              <span className="truncate text-caption text-muted-foreground">
                {rutaNombre}
              </span>
            </div>
            <ProgressRing value={0} size="md" showLabel={false} />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
            <PreviewRow label="Estado">
              <Badge status="ruta-cerrada">Sin crédito aún</Badge>
            </PreviewRow>
            <PreviewRow label="Documento">{values.documento || "—"}</PreviewRow>
            <PreviewRow label="Teléfono">{values.telefono || "—"}</PreviewRow>
            <PreviewRow label="Crédito al guardar">
              {values.abrirCredito ? "Se creará tras guardar" : "No"}
            </PreviewRow>
          </div>
        </div>
      </form>
    </>
  );
}

function CuotasEstimadasInline({ monto, cuota }: { monto: number; cuota: number }) {
  const cuotas = monto > 0 && cuota > 0 ? Math.ceil(monto / cuota) : 0;
  return (
    <div
      className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-caption text-muted-foreground"
      aria-live="polite"
    >
      <span>Cuotas estimadas</span>
      <span className="font-semibold text-foreground tabular-nums">
        {cuotas > 0 ? cuotas : "—"}
      </span>
    </div>
  );
}
