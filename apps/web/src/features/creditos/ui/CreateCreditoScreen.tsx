"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCreditoRequestSchema, type CreateCreditoRequest } from "@repo/types";
import { toast } from "sonner";

import { calcularCredito, type CreditoCalculo } from "@/entities/credit";
import { cn } from "@/shared/lib/utils";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

import { ClientePicker, ProductoField } from "@/features/creditos/ui/CreditoFields";

import { useCreateCredito } from "../api/use-creditos";

// DESIGN_SYSTEM.md §3.3 — pantalla Crear crédito (Admin, #9c). Panel izquierdo
// "Datos del crédito" (cliente + producto texto libre + monto/interés/días) y
// panel derecho "Cálculo estimado" en vivo (nº de cuotas, cuota diaria, total,
// duración, primeras cuotas). La cuota se DERIVA: cuota = (monto + interés)/días.
// El producto es texto libre con autocompletado; el backend lo registra (upsert).

const hoyISO = () => new Date().toISOString().slice(0, 10);

export interface CreateCreditoScreenProps {
  /** Si viene desde #5c con el cliente preseleccionado (#9c). */
  clienteIdInicial?: string;
}

export function CreateCreditoScreen({ clienteIdInicial }: CreateCreditoScreenProps) {
  const router = useRouter();
  const createCredito = useCreateCredito();

  const form = useForm<CreateCreditoRequest>({
    resolver: zodResolver(createCreditoRequestSchema),
    mode: "onBlur",
    defaultValues: {
      clienteId: clienteIdInicial ?? "",
      producto: "",
      monto: undefined,
      interes: undefined,
      dias: undefined,
      fechaInicio: hoyISO(),
    },
  });

  const { control, register, setValue, getValues, formState } = form;

  useEffect(() => {
    if (clienteIdInicial) {
      setValue("clienteId", clienteIdInicial, { shouldValidate: true });
    }
  }, [clienteIdInicial, setValue]);

  const watched = form.watch();

  const calc = calcularCredito(
    Number(watched.monto ?? 0),
    Number(watched.interes ?? 0),
    Number(watched.dias ?? 0),
  );

  async function onSubmit(values: CreateCreditoRequest) {
    try {
      const credito = await createCredito.mutateAsync(values);
      toast.success("Crédito creado");
      router.push(`/admin/credits/${credito.id}`);
    } catch {
      toast.error("No se pudo crear el crédito");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <AdminPageHeader
        eyebrow="Créditos / Nuevo"
        title="Crear crédito"
        subtitle="Asigna un crédito a un cliente. La cuota diaria se calcula automáticamente."
      />

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Panel izquierdo — Datos del crédito */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
            <p className="text-caption text-muted-foreground uppercase">Datos del crédito</p>

            <Controller
              control={control}
              name="clienteId"
              render={({ field }) => (
                <ClientePicker
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  error={formState.errors.clienteId?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="producto"
              render={({ field }) => (
                <ProductoField
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onPickPrecio={(precio) => {
                    // Prellena el monto con el precio base solo si está vacío.
                    if (!getValues("monto")) {
                      setValue("monto", precio, { shouldValidate: true });
                    }
                  }}
                  error={formState.errors.producto?.message}
                />
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="monto"
                label="Monto del crédito (COP)"
                error={formState.errors.monto?.message}
              >
                <Input
                  id="monto"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="200000"
                  {...register("monto", { valueAsNumber: true })}
                />
              </Field>
              <Field id="interes" label="% de interés" error={formState.errors.interes?.message}>
                <Input
                  id="interes"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  placeholder="40"
                  {...register("interes", { valueAsNumber: true })}
                />
              </Field>
              <Field
                id="dias"
                label="Días (número de cuotas)"
                error={formState.errors.dias?.message}
              >
                <Input
                  id="dias"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="30"
                  {...register("dias", { valueAsNumber: true })}
                />
              </Field>
              <Field
                id="fechaInicio"
                label="Fecha de inicio"
                error={formState.errors.fechaInicio?.message}
              >
                <Input id="fechaInicio" type="date" {...register("fechaInicio")} />
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" loading={createCredito.isPending}>
              Crear crédito
            </Button>
          </div>
        </div>

        {/* Panel derecho — Cálculo estimado */}
        <CalculoPanel
          interes={Number(watched.interes ?? 0)}
          calc={calc}
          fechaInicio={watched.fechaInicio ?? hoyISO()}
        />
      </div>
    </form>
  );
}

function CalculoPanel({
  interes,
  calc,
  fechaInicio,
}: {
  interes: number;
  calc: CreditoCalculo;
  fechaInicio: string;
}) {
  const base = parseFecha(fechaInicio);
  const tieneDatos = calc.cuotaDiaria > 0;
  const semanas = calc.cuotas > 0 ? Math.ceil(calc.cuotas / 7) : 0;
  const ultimaCuota = calc.cuotas > 0 ? addDays(base, calc.cuotas) : null;
  const primeras =
    calc.cuotas > 0
      ? Array.from({ length: Math.min(3, calc.cuotas) }, (_, i) => addDays(base, i + 1))
      : [];

  return (
    <div className="flex flex-col gap-6 self-start rounded-lg border border-border bg-card p-6 lg:sticky lg:top-6">
      <p className="text-caption font-semibold uppercase tracking-wide text-primary">
        Cálculo estimado
      </p>

      <div className="flex flex-col gap-1">
        <span className="text-caption text-muted-foreground">Número de cuotas</span>
        <span className="text-display font-bold leading-none tabular-nums">
          {tieneDatos ? calc.cuotas : "—"}
        </span>
        <span className="text-body-sm text-muted-foreground">
          {tieneDatos
            ? `cuotas diarias de ${formatCurrency(calc.cuotaDiaria)}`
            : "Completa monto, interés y días"}
        </span>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <Row
          label={`Interés (${interes > 0 ? interes : 0}%)`}
          value={calc.interesTotal > 0 ? formatCurrency(calc.interesTotal) : "—"}
        />
        <Row
          label="Monto total"
          value={calc.montoTotal > 0 ? formatCurrency(calc.montoTotal) : "—"}
          strong
        />
        <Row
          label="Duración"
          value={semanas > 0 ? `~ ${semanas} semana${semanas === 1 ? "" : "s"}` : "—"}
        />
        <Row label="Última cuota" value={ultimaCuota ? fmtFecha(ultimaCuota) : "—"} />
      </div>

      {primeras.length > 0 ? (
        <div className="flex flex-col gap-2.5 border-t border-border pt-5">
          <span className="text-caption uppercase tracking-wide text-muted-foreground">
            Primeras cuotas
          </span>
          {primeras.map((d, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Cuota {i + 1} · {fmtFechaCorta(d)}
              </span>
              <span className="font-medium tabular-nums">{formatCurrency(calc.cuotaDiaria)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
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

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", strong ? "text-base font-semibold" : "font-medium")}>
        {value}
      </span>
    </div>
  );
}

// --- fechas (vista previa) ---------------------------------------------------
function parseFecha(s: string): Date {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function fmtFecha(d: Date): string {
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

function fmtFechaCorta(d: Date): string {
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}
