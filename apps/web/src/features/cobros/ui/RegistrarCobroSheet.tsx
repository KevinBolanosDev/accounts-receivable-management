"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createCobroRequestSchema,
  type CobroResponse,
  type CreateCobroRequest,
  type CreditoListItem,
} from "@repo/types";

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
  /** Lista de créditos activos del cliente (puede venir de `useRutaHoy` o del detalle). */
  creditos: CreditoListItem[];
  /** Crédito preseleccionado cuando solo hay uno activo (15c). */
  creditoPreseleccionado?: CreditoListItem;
  /** Trigger personalizado (botón "Registrar cobro" en #16c). */
  children: React.ReactNode;
  /** Callback tras un cobro exitoso (para invalidar queries externas si hace falta). */
  onCobrado?: (resp: CobroResponse) => void;
}

// DESIGN_SYSTEM.md §3.5 — bottom sheet de cobro (#16c móvil). Si hay varios
// créditos activos se obliga a elegir uno (selector); si hay uno solo, se
// pre-selecciona. El monto se pre-rellena con la cuota diaria del crédito
// elegido y es editable. La validación es `createCobroRequestSchema` (Zod on-blur).
// La actualización es optimista (definida en `use-cobros.ts`); al confirmar,
// `registrarCobro.mutateAsync` ya reconcilia con el `CobroResponse` del server.

export function RegistrarCobroSheet({
  creditos,
  creditoPreseleccionado,
  children,
  onCobrado,
}: RegistrarCobroSheetProps) {
  const [open, setOpen] = React.useState(false);
  const initialCreditoId =
    creditoPreseleccionado?.id ?? (creditos.length === 1 ? creditos[0]?.id ?? "" : "");

  const form = useForm<CreateCobroRequest>({
    resolver: zodResolver(createCobroRequestSchema),
    mode: "onBlur",
    defaultValues: {
      creditoId: initialCreditoId,
      monto: creditoPreseleccionado?.cuotaDiaria ?? 0,
    },
  });

  const creditoId = form.watch("creditoId");
  const monto = form.watch("monto");
  const creditoElegido = creditos.find((c) => c.id === creditoId) ?? null;
  const saldo = creditoElegido?.saldoPendiente ?? 0;

  // Cuando el cobrador cambia el crédito del selector, re-rellenamos el monto
  // con la cuota diaria del nuevo crédito (UX del diseño).
  React.useEffect(() => {
    if (creditoElegido && Number.isFinite(monto)) {
      const current = form.getValues("monto");
      // Sólo re-rellenar si el monto coincide con el de OTRO crédito, no pisar
      // el valor que el cobrador pueda haber editado a mano.
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
      return;
    }
    try {
      const result = await registrar.mutateAsync(values);
      onCobrado?.(result);
      setOpen(false);
    } catch {
      // El rollback optimista ya se ejecutó en onError; dejamos el sheet abierto
      // para que el cobrador vea el saldo real y pueda reintentar.
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Registrar cobro</SheetTitle>
          <SheetDescription>
            El saldo se actualiza al instante al confirmar.
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
            <Input
              id="monto"
              type="number"
              min={0}
              inputMode="numeric"
              className="h-12 text-h3 font-semibold tabular-nums"
              {...form.register("monto", { valueAsNumber: true })}
            />
            {form.formState.errors.monto ? (
              <p className="text-body-sm text-destructive" role="alert">
                {form.formState.errors.monto.message}
              </p>
            ) : null}
            <p className="text-caption text-muted-foreground">
              Cuota sugerida: {formatCurrency(creditoElegido?.cuotaDiaria ?? 0)}
              {" · "}Saldo pendiente:{" "}
              <span className={cn("font-semibold tabular-nums")}>
                {formatCurrency(saldo)}
              </span>
            </p>
          </div>
        </form>

        <SheetFooter className="gap-3">
          <SheetClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </SheetClose>
          <Button
            type="submit"
            form="registrar-cobro"
            size="lg"
            loading={registrar.isPending}
          >
            Confirmar cobro
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
