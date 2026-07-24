"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  createCobroRequestSchema,
  type CobroResponse,
  type CreateCobroRequest,
  type CreditoListItem,
} from "@repo/types";
import { toast } from "sonner";

import { formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";

import { useRegistrarCobro } from "../api/use-cobros";

interface RegistrarCobroSheetProps {
  /** Lista de créditos activos del cliente. */
  creditos: CreditoListItem[];
  /** Crédito preseleccionado cuando solo hay uno activo. */
  creditoPreseleccionado?: CreditoListItem;
  /** Nombre del cliente para el subtítulo ("Cuota diaria de …"). */
  clienteNombre?: string;
  /** Trigger personalizado (botón "Registrar cobro" en #16c). */
  children: React.ReactNode;
  /** Callback tras un cobro exitoso. */
  onCobrado?: (resp: CobroResponse) => void;
}

// DESIGN_SYSTEM.md §3.5 / #16c — bottom sheet de cobro. El monto llega
// prellenado con la cuota diaria en MODO LECTURA (tarjeta con "Editar"); al
// editar se vuelve input. Muestra la vista previa del "Nuevo saldo pendiente"
// y confirma con el botón en degradado de marca. Si hay varios créditos
// activos se obliga a elegir uno. La actualización es optimista (use-cobros).

export function RegistrarCobroSheet({
  creditos,
  creditoPreseleccionado,
  clienteNombre,
  children,
  onCobrado,
}: RegistrarCobroSheetProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editandoMonto, setEditandoMonto] = React.useState(false);
  const initialCreditoId =
    creditoPreseleccionado?.id ?? (creditos.length === 1 ? creditos[0]?.id ?? "" : "");

  const form = useForm<CreateCobroRequest>({
    resolver: zodResolver(createCobroRequestSchema),
    mode: "onBlur",
    defaultValues: {
      creditoId: initialCreditoId,
      monto: creditoPreseleccionado?.cuotaDiaria ?? creditos[0]?.cuotaDiaria ?? 0,
    },
  });

  const creditoId = useWatch({ control: form.control, name: "creditoId" });
  const monto = useWatch({ control: form.control, name: "monto" });
  const creditoElegido = creditos.find((c) => c.id === creditoId) ?? null;
  const saldo = creditoElegido?.saldoPendiente ?? 0;
  const montoNum = Number.isFinite(monto) ? monto : 0;
  const nuevoSaldo = Math.max(0, saldo - montoNum);

  // Cuando el cobrador cambia el crédito del selector, re-rellenamos el monto
  // con la cuota diaria del nuevo crédito (sin pisar un valor editado a mano).
  React.useEffect(() => {
    if (creditoElegido && Number.isFinite(monto)) {
      const current = form.getValues("monto");
      const matchesOther = creditos.some(
        (c) => c.id !== creditoElegido.id && c.cuotaDiaria === current,
      );
      if (!current || matchesOther) {
        form.setValue("monto", creditoElegido.cuotaDiaria, { shouldValidate: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditoId]);

  const registrar = useRegistrarCobro();

  async function onSubmit(values: CreateCobroRequest) {
    if (saldo > 0 && values.monto > saldo) {
      form.setError("monto", {
        type: "manual",
        message: `El monto no puede superar el saldo pendiente (${formatCurrency(saldo)}).`,
      });
      setEditandoMonto(true);
      return;
    }
    try {
      const result = await registrar.mutateAsync(values);
      onCobrado?.(result);
      toast.success("Cobro registrado");
      setOpen(false);
      setEditandoMonto(false);
      // 4.7 — Navega al recibo fresco. El store efímero (`useLastCobroStore`)
      // ya tiene el `CobroResponse` seteado por `useRegistrarCobro.onSuccess`.
      // `?fromCobro=true` le dice a la pantalla del recibo que use el store
      // antes de pegarle al back (4.9 ya distingue ambos caminos).
      router.push(`/collector/receipts/${result.pago.id}?fromCobro=true`);
    } catch (error) {
      // El backend puede rechazar por carrera de saldo (409), scoping (403) o
      // validación (400/404) — dejamos el sheet abierto para que el cobrador
      // vea el error y pueda ajustar el monto o reintentar.
      const message = error instanceof Error ? error.message : "No se pudo registrar el cobro.";
      toast.error(message);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setEditandoMonto(false);
      }}
    >
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-h3">Registrar cobro</SheetTitle>
          <SheetDescription>
            {clienteNombre
              ? `Cuota diaria de ${clienteNombre}`
              : "El saldo se actualiza al instante al confirmar."}
          </SheetDescription>
        </SheetHeader>

        <form
          id="registrar-cobro"
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4 px-4 py-2"
        >
          {creditos.length > 1 ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="credito-id">Crédito</Label>
              <Select
                value={creditoId || undefined}
                onValueChange={(v) => form.setValue("creditoId", v, { shouldValidate: true })}
              >
                <SelectTrigger id="credito-id" className="w-full">
                  <SelectValue placeholder="Selecciona un crédito" />
                </SelectTrigger>
                <SelectContent>
                  {creditos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo} · {c.producto} · {formatCurrency(c.saldoPendiente)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.creditoId ? (
                <p className="text-body-sm text-destructive" role="alert">
                  {form.formState.errors.creditoId.message}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="monto">Monto</Label>
            {editandoMonto ? (
              <Input
                id="monto"
                type="number"
                min={0}
                inputMode="numeric"
                autoFocus
                className="h-12 text-h3 font-semibold tabular-nums"
                {...form.register("monto", { valueAsNumber: true })}
              />
            ) : (
              <div className="flex h-12 items-center justify-between rounded-md bg-muted/50 px-4">
                <span className="text-h3 font-semibold tabular-nums">
                  {formatCurrency(montoNum)}
                </span>
                <button
                  type="button"
                  onClick={() => setEditandoMonto(true)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Editar
                </button>
              </div>
            )}
            {form.formState.errors.monto ? (
              <p className="text-body-sm text-destructive" role="alert">
                {form.formState.errors.monto.message}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Nuevo saldo pendiente</span>
            <span className="font-bold tabular-nums">{formatCurrency(nuevoSaldo)}</span>
          </div>
        </form>

        <SheetFooter className="flex-col gap-2">
          <Button
            type="submit"
            form="registrar-cobro"
            size="lg"
            loading={registrar.isPending}
            className={cn(
              "w-full bg-gradient-to-r from-primary to-accent text-primary-foreground",
              "hover:opacity-95",
            )}
          >
            Confirmar cobro
          </Button>
          <SheetClose asChild>
            <Button type="button" variant="ghost" className="w-full">
              Cancelar
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
