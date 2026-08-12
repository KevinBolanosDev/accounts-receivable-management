"use client";

import * as React from "react";
import { Controller, useFormContext } from "react-hook-form";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import type { FrecuenciaPago } from "@repo/types";

import {
  CUOTAS_PLURAL,
  CUOTA_LABEL,
  FRECUENCIA_OPTIONS,
  calcularCredito,
} from "@/entities/credit";
import { getInitials } from "@/shared/lib/initials";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

import { useClientes } from "@/features/clients/api/use-clientes";
import { useProductos } from "@/features/productos/api/use-productos";

// DESIGN_SYSTEM.md §3.4 — `CreditoFields` es el sub-componente reutilizable
// compartido por composición entre Crear crédito (#9c), el alta de cliente con
// crédito opcional (#4c) y el "Nuevo crédito" del móvil (#15c). Fase 3 (revisión):
// `producto` es texto libre con autocompletado (datalist del inventario) y el
// crédito se define con `monto` (capital) + `interes` (%) + `dias`; la cuota se
// deriva (no se ingresa). Los campos viven aquí para no duplicar lógica (3.4 — FSD).

interface CreditoFieldsForm {
  producto?: string;
  monto?: number;
  interes?: number;
  frecuencia?: FrecuenciaPago;
  cuotas?: number;
}

interface CreditoFieldsProps {
  /** Mensajes de error a pintar (los entrega el formulario padre). */
  errors?: {
    producto?: string;
    monto?: string;
    interes?: string;
    frecuencia?: string;
    cuotas?: string;
  };
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
        <p className="text-body-sm text-destructive-strong" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface ProductoFieldProps {
  value: string;
  onChange: (nombre: string) => void;
  /** Se dispara al escribir/elegir un producto ya registrado (para prellenar el monto). */
  onPickPrecio?: (precioBase: number) => void;
  error?: string;
}

// Campo de producto: texto libre con autocompletado nativo (`<datalist>`) desde
// el inventario. Escribes lo que quieras; si coincide con un producto
// registrado, se prellena el monto con su precio base (editable). El registro
// del producto (upsert por nombre) lo hace el backend al crear el crédito.
function ProductoField({ value, onChange, onPickPrecio, error }: ProductoFieldProps) {
  const listId = React.useId();
  const { data: productos = [] } = useProductos();

  return (
    <Field id="credito-producto" label="Producto" error={error}>
      <div className="relative">
        <Input
          id="credito-producto"
          list={listId}
          autoComplete="off"
          placeholder="Escribe o elige un producto"
          className="pr-9"
          value={value ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v);
            const match = productos.find(
              (p) => p.nombre.toLowerCase() === v.trim().toLowerCase(),
            );
            if (match) onPickPrecio?.(match.precioBase);
          }}
        />
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <datalist id={listId}>
          {productos.map((p) => (
            <option key={p.id} value={p.nombre}>
              {formatCurrency(p.precioBase)}
            </option>
          ))}
        </datalist>
      </div>
    </Field>
  );
}

interface FrecuenciaFieldProps {
  value: FrecuenciaPago;
  onChange: (frecuencia: FrecuenciaPago) => void;
  error?: string;
}

// Cada cuánto vence una cuota. Es un `<Select>` y no un grupo de radios porque
// convive con los demás campos del formulario en la misma grilla, y porque las
// opciones son mutuamente excluyentes y estables (tres).
//
// Componente propio (y exportado) porque lo montan las TRES pantallas que crean
// créditos: "Crear crédito" del Admin, el alta de cliente con crédito opcional y
// el alta en campo del Cobrador.
function FrecuenciaField({ value, onChange, error }: FrecuenciaFieldProps) {
  return (
    <Field id="credito-frecuencia" label="Frecuencia de pago" error={error}>
      <Select value={value} onValueChange={(v) => onChange(v as FrecuenciaPago)}>
        <SelectTrigger id="credito-frecuencia" className="w-full">
          <SelectValue placeholder="Diaria" />
        </SelectTrigger>
        <SelectContent>
          {FRECUENCIA_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function CreditoFields({ errors, className }: CreditoFieldsProps) {
  const form = useFormContext<CreditoFieldsForm>();
  const { control, register, setValue, getValues } = form;

  const monto = Number(form.watch("monto") ?? 0);
  const interes = Number(form.watch("interes") ?? 0);
  const cuotas = Number(form.watch("cuotas") ?? 0);
  const frecuencia = form.watch("frecuencia") ?? "DIARIO";
  const calc = calcularCredito(monto, interes, cuotas);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Controller
        control={control}
        name="producto"
        render={({ field }) => (
          <ProductoField
            value={field.value ?? ""}
            onChange={field.onChange}
            onPickPrecio={(precio) => {
              // Prellena el monto solo si está vacío (no pisa lo tecleado).
              const actual = getValues("monto");
              if (!actual) setValue("monto", precio, { shouldValidate: true });
            }}
            error={errors?.producto}
          />
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field id="credito-monto" label="Monto (COP)" error={errors?.monto}>
          <Input
            id="credito-monto"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="200000"
            {...register("monto", { valueAsNumber: true })}
          />
        </Field>
        <Field id="credito-interes" label="% de interés" error={errors?.interes}>
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
        <Field id="credito-cuotas" label="N° de cuotas" error={errors?.cuotas}>
          <Input
            id="credito-cuotas"
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="30"
            {...register("cuotas", { valueAsNumber: true })}
          />
        </Field>
      </div>

      <Controller
        control={control}
        name="frecuencia"
        render={({ field }) => (
          <FrecuenciaField
            value={field.value ?? "DIARIO"}
            onChange={field.onChange}
            error={errors?.frecuencia}
          />
        )}
      />

      <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-caption text-muted-foreground">
        <span>
          {CUOTA_LABEL[frecuencia]} estimada
          {calc.cuotas > 0 ? ` · ${calc.cuotas} ${CUOTAS_PLURAL[frecuencia]}` : ""}
        </span>
        <span className="font-semibold text-foreground tabular-nums">
          {calc.cuotaDiaria > 0 ? formatCurrency(calc.cuotaDiaria) : "—"}
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
              "flex w-full items-center gap-3 rounded-md border border-input bg-background px-3 py-2.5 text-left text-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            {selected ? (
              <>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary-strong">
                  {getInitials(selected.nombre)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-foreground">{selected.nombre}</span>
                  <span className="truncate text-caption text-muted-foreground">
                    {selected.ruta?.nombre ?? "Sin ruta"}
                  </span>
                </span>
              </>
            ) : (
              <span className="flex-1 text-muted-foreground">Selecciona un cliente</span>
            )}
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0">
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
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
                      {getInitials(c.nombre)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{c.nombre}</span>
                      <span className="truncate text-caption text-muted-foreground">
                        {(c.ruta?.nombre ?? "Sin ruta") + " · " + c.documento}
                      </span>
                    </span>
                    <CheckIcon
                      className={cn(
                        "ml-auto size-4 shrink-0",
                        value === c.id ? "opacity-100" : "opacity-0",
                      )}
                    />
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

export { CreditoFields, ClientePicker, ProductoField, FrecuenciaField };
export type {
  CreditoFieldsProps,
  CreditoFieldsForm,
  ClientePickerProps,
  ProductoFieldProps,
  FrecuenciaFieldProps,
};
