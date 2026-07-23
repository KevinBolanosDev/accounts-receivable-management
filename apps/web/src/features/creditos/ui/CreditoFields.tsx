"use client";

import * as React from "react";
import { Controller, useFormContext } from "react-hook-form";
import { CheckIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { formatCurrency } from "@/shared/lib/format-currency";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/command";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

import { useClientes } from "@/features/clients/api/use-clientes";
import { useProductos } from "@/features/productos/api/use-productos";

// DESIGN_SYSTEM.md §3.4 — `CreditoFields` es el sub-componente reutilizable
// compartido por composición entre la pantalla Crear crédito (#9c), el alta
// de cliente con crédito opcional (#4c) y el flujo de "Nuevo crédito" del
// móvil (#15c). Los campos viven aquí para no duplicar lógica ni acoplar
// features (3.4 — FSD).

interface CreditoFieldsForm {
  productoId?: string;
  montoTotal?: number;
  cuotaDiaria?: number;
}

interface CreditoFieldsProps {
  /** Mensajes de error a pintar (los entrega el formulario padre). */
  errors?: {
    productoId?: string;
    montoTotal?: string;
    cuotaDiaria?: string;
  };
  /** Si el padre quiere su propio combobox de cliente (sólo cambia el visual). */
  hideClientePicker?: boolean;
  /** Si el padre quiere que NO se renderice este bloque (lo usar #4c con un toggle). */
  collapsed?: boolean;
  className?: string;
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

function CreditoFields({ errors, className }: CreditoFieldsProps) {
  const form = useFormContext<CreditoFieldsForm>();
  const { register, control } = form;
  const watchedMonto = form.watch("montoTotal");
  const watchedCuota = form.watch("cuotaDiaria");

  const monto = Number(watchedMonto ?? 0);
  const cuota = Number(watchedCuota ?? 0);
  const cuotasEstimadas = monto > 0 && cuota > 0 ? Math.ceil(monto / cuota) : 0;

  const productos = useProductos();
  const productosList = productos.data ?? [];

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Controller
        control={control}
        name="productoId"
        render={({ field }) => (
          <Field id="credito-producto" label="Producto" error={errors?.productoId}>
            <Select value={field.value || undefined} onValueChange={field.onChange}>
              <SelectTrigger id="credito-producto" className="w-full">
                <SelectValue placeholder="Selecciona un producto" />
              </SelectTrigger>
              <SelectContent>
                {productosList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} · {formatCurrency(p.precioBase)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="credito-monto" label="Monto total" error={errors?.montoTotal}>
          <Input
            id="credito-monto"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="1500000"
            {...register("montoTotal", { valueAsNumber: true })}
          />
        </Field>
        <Field id="credito-cuota" label="Cuota diaria" error={errors?.cuotaDiaria}>
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

      <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-caption text-muted-foreground">
        <span>Cuotas estimadas</span>
        <span className="font-semibold text-foreground tabular-nums">
          {cuotasEstimadas > 0 ? cuotasEstimadas : "—"}
        </span>
      </div>
    </div>
  );
}

interface ClientePickerProps {
  value: string;
  onChange: (id: string) => void;
  error?: string;
  disabled?: boolean;
}

// Combobox agnóstico (no depende del form context) — usado por CreateCreditoScreen
// para el cliente del nuevo crédito.
function ClientePicker({ value, onChange, error, disabled }: ClientePickerProps) {
  const [open, setOpen] = React.useState(false);
  const { data: clientes = [] } = useClientes();
  const selected = clientes.find((c) => c.id === value) ?? null;

  return (
    <Field id="credito-cliente" label="Cliente" error={error}>
      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <button
            id="credito-cliente"
            type="button"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              !selected && "text-muted-foreground",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            {selected ? selected.nombre : "Selecciona un cliente"}
            <CheckIcon className={cn("size-4 opacity-50", selected && "opacity-100")} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command>
            <CommandInput placeholder="Buscar cliente..." />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                {clientes.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.nombre} ${c.documento}`}
                    onSelect={() => {
                      onChange(c.id);
                      setOpen(false);
                    }}
                  >
                    <CheckIcon className={cn(value === c.id ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{c.nombre}</span>
                    <span className="ml-auto text-caption text-muted-foreground">
                      {c.documento}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </Field>
  );
}

export { CreditoFields, ClientePicker };
export type { CreditoFieldsProps, CreditoFieldsForm, ClientePickerProps };

// Silencia "unused" si trabajTree fuera estricto con `watchedProductoId`.
// (Útil si más adelante queremos mostrar la cuota sugerida por producto.)
void useProductos;
