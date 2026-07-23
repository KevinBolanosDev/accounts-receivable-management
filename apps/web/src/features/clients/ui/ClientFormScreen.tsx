"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  createClienteRequestSchema,
  type CreateClienteRequest,
} from "@repo/types";
import { toast } from "sonner";
import { ChevronsUpDownIcon } from "lucide-react";

import { calcularCredito } from "@/entities/credit";
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
import { useCreateCredito } from "@/features/creditos/api/use-creditos";
import { ProductoField } from "@/features/creditos/ui/CreditoFields";

import { useCliente, useCreateCliente, useUpdateCliente } from "../api/use-clientes";
import { DocumentUploader } from "./DocumentUploader";

// Radix Select no admite `value=""`; se usa este centinela para el ítem "Sin
// ruta" (§3 — cierre de Fase 3, `rutaId` ahora nullable) y se traduce a
// `null` al leerlo.
const SIN_RUTA = "__sin_ruta__";

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
  producto: string;
  monto?: number | undefined;
  interes?: number | undefined;
  dias?: number | undefined;
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
  producto: "",
  monto: undefined,
  interes: undefined,
  dias: undefined,
};

export function ClientFormScreen({ clienteId }: { clienteId?: string }) {
  const isEdit = !!clienteId;
  const router = useRouter();
  const { data: cliente } = useCliente(clienteId ?? "");
  const { data: rutas = [] } = useRutas();
  const createCliente = useCreateCliente();
  const updateCliente = useUpdateCliente(clienteId ?? "");
  const createCredito = useCreateCredito();

  const form = useForm<FormValues>({
    // `raw: true` — sin esto, zodResolver STRIPEA del resultado cualquier
    // campo que no esté en createClienteRequestSchema (comportamiento por
    // defecto de z.object().parse()), así que abrirCredito/producto/monto/
    // interes/dias nunca llegarían a onSubmit aunque el usuario los llene
    // (bug preexistente: el crédito opcional nunca se creaba).
    resolver: zodResolver(createClienteRequestSchema, undefined, { raw: true }) as never,
    mode: "onBlur",
    defaultValues: DEFAULTS,
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    reset,
    formState: { errors },
    setError,
  } = form;

  // En edición, precargar el formulario con los datos reales del cliente.
  // Sin esto, los campos salen en blanco y al guardar sobrescriben datos.
  useEffect(() => {
    if (isEdit && cliente) {
      reset({
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        documento: cliente.documento,
        direccion: cliente.direccion,
        rutaId: cliente.rutaId ?? "",
        fotoDocumentoFrenteUrl: cliente.fotoDocumentoFrenteUrl,
        fotoDocumentoReversoUrl: cliente.fotoDocumentoReversoUrl,
        abrirCredito: false,
        producto: "",
        monto: undefined,
        interes: undefined,
        dias: undefined,
      });
    }
  }, [isEdit, cliente, reset]);

  const abrirCredito = useWatch({ control, name: "abrirCredito" });
  const values = useWatch({ control });
  const rutaNombre =
    rutas.find((route) => route.id === values.rutaId)?.nombre ?? "Sin ruta";

  async function onSubmit(v: FormValues) {
    // Validación inline del bloque opcional (sub-fase 3.4). RHF no entiende
    // campos cruzados en este formulario único sin un esquema ampliado, así
    // que validamos a mano antes de salir.
    if (!isEdit && v.abrirCredito) {
      const fieldErrors: Array<{ name: keyof CreditoOpcional; message: string }> = [];
      if (!v.producto?.trim()) fieldErrors.push({ name: "producto", message: "Escribe el producto." });
      if (typeof v.monto !== "number" || v.monto <= 0) {
        fieldErrors.push({ name: "monto", message: "El monto debe ser mayor a 0." });
      }
      if (typeof v.interes !== "number" || v.interes < 0) {
        fieldErrors.push({ name: "interes", message: "El interés no puede ser negativo." });
      }
      if (typeof v.dias !== "number" || v.dias <= 0) {
        fieldErrors.push({ name: "dias", message: "Los días deben ser mayor a 0." });
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
        v.producto?.trim() &&
        typeof v.monto === "number" &&
        typeof v.interes === "number" &&
        typeof v.dias === "number"
      ) {
        try {
          await createCredito.mutateAsync({
            clienteId: clienteCreado.id,
            producto: v.producto.trim(),
            monto: v.monto,
            interes: v.interes,
            dias: v.dias,
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
                  <Select
                    value={field.value || SIN_RUTA}
                    onValueChange={(v) => field.onChange(v === SIN_RUTA ? null : v)}
                  >
                    <SelectTrigger id="ruta" className="w-full">
                      <SelectValue placeholder="Selecciona una ruta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SIN_RUTA}>Sin ruta</SelectItem>
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
                  <Controller
                    control={control}
                    name="producto"
                    render={({ field }) => (
                      <ProductoField
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onPickPrecio={(precio) => {
                          if (!getValues("monto")) {
                            setValue("monto", precio, { shouldValidate: true });
                          }
                        }}
                        error={errors.producto?.message}
                      />
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field id="credito-monto" label="Monto (COP)" error={errors.monto?.message}>
                      <Input
                        id="credito-monto"
                        type="number"
                        min={0}
                        inputMode="numeric"
                        placeholder="200000"
                        {...register("monto", { valueAsNumber: true })}
                      />
                    </Field>
                    <Field id="credito-interes" label="% de interés" error={errors.interes?.message}>
                      <Input
                        id="credito-interes"
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        placeholder="40"
                        {...register("interes", { valueAsNumber: true })}
                      />
                    </Field>
                    <Field id="credito-dias" label="Días" error={errors.dias?.message}>
                      <Input
                        id="credito-dias"
                        type="number"
                        min={1}
                        inputMode="numeric"
                        placeholder="30"
                        {...register("dias", { valueAsNumber: true })}
                      />
                    </Field>
                  </div>

                  <CuotasEstimadasInline
                    monto={Number(values.monto ?? 0)}
                    interes={Number(values.interes ?? 0)}
                    dias={Number(values.dias ?? 0)}
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

function CuotasEstimadasInline({
  monto,
  interes,
  dias,
}: {
  monto: number;
  interes: number;
  dias: number;
}) {
  const calc = calcularCredito(monto, interes, dias);
  return (
    <div
      className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-caption text-muted-foreground"
      aria-live="polite"
    >
      <span>
        Cuota diaria estimada
        {calc.cuotas > 0 ? ` · ${calc.cuotas} cuotas` : ""}
      </span>
      <span className="font-semibold text-foreground tabular-nums">
        {calc.cuotaDiaria > 0 ? formatCurrency(calc.cuotaDiaria) : "—"}
      </span>
    </div>
  );
}
