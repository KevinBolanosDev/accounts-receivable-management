"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createCreditoRequestSchema,
  type CreateCreditoRequest,
} from "@repo/types";
import { toast } from "sonner";

import { formatCurrency } from "@/shared/lib/format-currency";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/shared/ui/form";
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

import { useClientes } from "@/features/clients/api/use-clientes";
import { ClientePicker } from "@/features/creditos/ui/CreditoFields";
import { useProductos } from "@/features/productos/api/use-productos";

import { useCreateCredito } from "../api/use-creditos";

// DESIGN_SYSTEM.md §3.3 — pantalla Crear crédito (Admin, #9c). Combobox de
// cliente + Select de producto + monto/cuota con cálculo en vivo de cuotas
// estimadas. La validación es Zod inline (resolver on-blur).

export interface CreateCreditoScreenProps {
  /** Si viene desde #5c con el cliente preseleccionado (#9c). */
  clienteIdInicial?: string;
}

export function CreateCreditoScreen({ clienteIdInicial }: CreateCreditoScreenProps) {
  const router = useRouter();
  const createCredito = useCreateCredito();
  const { data: clientes = [] } = useClientes();
  const { data: productos = [] } = useProductos();

  const form = useForm<CreateCreditoRequest>({
    resolver: zodResolver(createCreditoRequestSchema),
    mode: "onBlur",
    defaultValues: {
      clienteId: clienteIdInicial ?? "",
      productoId: "",
      montoTotal: undefined,
      cuotaDiaria: undefined,
      fechaInicio: undefined,
    },
  });

  useEffect(() => {
    if (clienteIdInicial) {
      form.setValue("clienteId", clienteIdInicial, { shouldValidate: true });
    }
  }, [clienteIdInicial, form]);

  const watched = form.watch();
  const clienteSeleccionado = useMemo(
    () => clientes.find((c) => c.id === watched.clienteId) ?? null,
    [clientes, watched.clienteId],
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <AdminPageHeader
          eyebrow="Créditos / Nuevo"
          title="Crear crédito"
          subtitle="Asigna un crédito a un cliente y define su cuota diaria."
        />

        <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
              <p className="text-caption text-muted-foreground uppercase">Cliente y producto</p>

              <FormField
                control={form.control}
                name="clienteId"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ClientePicker
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        error={form.formState.errors.clienteId?.message}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="productoId"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="credito-producto">Producto</Label>
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
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
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
              <p className="text-caption text-muted-foreground uppercase">Plan de pagos</p>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="montoTotal"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <MontoField
                          id="monto-total"
                          label="Monto total"
                          value={Number.isFinite(field.value) ? field.value : undefined}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          error={form.formState.errors.montoTotal?.message}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cuotaDiaria"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <MontoField
                          id="cuota-diaria"
                          label="Cuota diaria"
                          value={Number.isFinite(field.value) ? field.value : undefined}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          error={form.formState.errors.cuotaDiaria?.message}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <CuotasEstimadas
                monto={Number(watched.montoTotal ?? 0)}
                cuota={Number(watched.cuotaDiaria ?? 0)}
              />
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

          <PreviewPanel
            clienteNombre={clienteSeleccionado?.nombre ?? "Cliente"}
            montoTotal={Number(watched.montoTotal ?? 0)}
            cuotaDiaria={Number(watched.cuotaDiaria ?? 0)}
          />
        </div>
      </form>
    </Form>
  );
}

function MontoField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  onBlur: () => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        inputMode="numeric"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? undefined : Number(raw));
        }}
        onBlur={onBlur}
      />
      {error ? (
        <p className="text-body-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CuotasEstimadas({ monto, cuota }: { monto: number; cuota: number }) {
  const cuotas = monto > 0 && cuota > 0 ? Math.ceil(monto / cuota) : 0;
  return (
    <div
      className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-caption text-muted-foreground"
      aria-live="polite"
    >
      <span>
        Cuotas estimadas{" "}
        {cuota > 0 ? (
          <span>
            (si cobras {formatCurrency(cuota)} al día)
          </span>
        ) : null}
      </span>
      <span className="font-semibold text-foreground tabular-nums">
        {cuotas > 0 ? cuotas : "—"}
      </span>
    </div>
  );
}

function PreviewPanel({
  clienteNombre,
  montoTotal,
  cuotaDiaria,
}: {
  clienteNombre: string;
  montoTotal: number;
  cuotaDiaria: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-muted-foreground uppercase">Vista previa</p>
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <ProgressRing value={0} size="md" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-caption text-muted-foreground uppercase">Próximo crédito</span>
            <span className="truncate text-h3 font-semibold">{clienteNombre}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Row label="Monto total" value={montoTotal > 0 ? formatCurrency(montoTotal) : "—"} />
          <Row label="Cuota diaria" value={cuotaDiaria > 0 ? formatCurrency(cuotaDiaria) : "—"} />
          <Row label="Estado inicial">
            <Badge status="activo">Activo</Badge>
          </Row>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{children ?? value}</span>
    </div>
  );
}
