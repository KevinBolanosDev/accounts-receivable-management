"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftIcon, ChevronsUpDownIcon } from "lucide-react";
import { createClienteRequestSchema, type CreateClienteRequest } from "@repo/types";
import { toast } from "sonner";

import { calcularCredito } from "@/entities/credit";
import { useCreateCredito } from "@/features/creditos/api/use-creditos";
import { ProductoField } from "@/features/creditos/ui/CreditoFields";
import { useRutas } from "@/features/routes-collectors/api/use-rutas";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

import { useCreateCliente } from "../api/use-clientes";
import { DocumentUploader } from "./DocumentUploader";

const RUTA_CORTA = "Mi ruta";

interface CreditoOpcional {
  abrirCredito: boolean;
  producto: string;
  monto?: number | undefined;
  interes?: number | undefined;
  dias?: number | undefined;
}

type FormValues = CreateClienteRequest & CreditoOpcional;

// DESIGN_SYSTEM.md §4.4 — alta de cliente en la calle: hero de gradiente +
// tarjeta con el formulario (foto primero), cámara, y botón "Guardar" fijo al
// fondo (sobre el tab bar). El cobrador asigna a una de SUS rutas — si solo
// tiene una, se auto-asigna sin fricción; si tiene varias (un cobrador puede
// tener 0..N rutas), aparece un selector para elegir cuál. Incluye el mismo
// bloque colapsable "Agregar crédito (opcional)" que el alta del Admin
// (`ClientFormScreen`) — ver 3.4 — para no forzar una segunda pantalla.
export function FieldClientCreateScreen() {
  const router = useRouter();
  const createCliente = useCreateCliente();
  const createCredito = useCreateCredito();
  const { data: rutas = [] } = useRutas();
  const activeRoute = rutas[0];
  const tieneVariasRutas = rutas.length > 1;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors },
    setError,
  } = useForm<FormValues>({
    // `raw: true` — sin esto, zodResolver STRIPEA del resultado cualquier
    // campo que no esté en createClienteRequestSchema (comportamiento por
    // defecto de z.object().parse()), así que abrirCredito/producto/monto/
    // interes/dias nunca llegarían a onSubmit aunque el usuario los llene.
    resolver: zodResolver(createClienteRequestSchema, undefined, { raw: true }) as never,
    defaultValues: {
      nombre: "",
      telefono: "",
      documento: "",
      direccion: "",
      rutaId: activeRoute?.id ?? "",
      fotoDocumentoFrenteUrl: null,
      fotoDocumentoReversoUrl: null,
      abrirCredito: false,
      producto: "",
      monto: undefined,
      interes: undefined,
      dias: undefined,
    },
  });

  const fotos = useWatch({ control, name: ["fotoDocumentoFrenteUrl", "fotoDocumentoReversoUrl"] });
  const abrirCredito = useWatch({ control, name: "abrirCredito" });
  const values = useWatch({ control });
  const rutaSeleccionada = rutas.find((r) => r.id === values.rutaId) ?? activeRoute;

  async function onSubmit(v: FormValues) {
    // Validación inline del bloque opcional, igual que en el alta del Admin
    // (`ClientFormScreen`): RHF no valida campos cruzados en un formulario
    // único sin un esquema ampliado.
    if (v.abrirCredito) {
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
      router.push("/collector/clients");
    } catch {
      toast.error("No se pudo guardar el cliente");
    }
  }

  const saving = createCliente.isPending || createCredito.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-full flex-col">
      {/* Hero de gradiente con círculos decorativos de marca */}
      <div className="relative overflow-hidden bg-linear-to-br from-primary to-accent px-3 pt-6 pb-20 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full border border-white/20"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-12 -right-6 size-44 rounded-full border border-white/20"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-4 right-4 size-24 rounded-full border border-white/15"
        />
        <div className="relative flex items-center gap-1">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Volver"
            className="flex size-9 items-center justify-center rounded-full text-white hover:bg-white/10"
          >
            <ArrowLeftIcon className="size-5" />
          </button>
          <span className="text-lg font-semibold">Nuevo cliente</span>
          <span className="ml-auto rounded-full bg-white/20 px-3 py-1 text-caption font-medium">
            {rutaSeleccionada?.nombre?.split("·")[0]?.trim() ?? RUTA_CORTA}
          </span>
        </div>
      </div>

      <div className="mx-4 -mt-12 flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-lg z-10">
          <div className="flex flex-col gap-2 border-b border-border pb-4">
            <Label>Foto del documento</Label>
            <DocumentUploader
              capture
              placeholder="Frente"
              value={fotos[0] ?? null}
              onChange={(url) => setValue("fotoDocumentoFrenteUrl", url)}
            />
            <DocumentUploader
              capture
              placeholder="Reverso"
              value={fotos[1] ?? null}
              onChange={(url) => setValue("fotoDocumentoReversoUrl", url)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-nombre">Nombre completo</Label>
            <Input id="f-nombre" className="h-12 bg-muted" placeholder="Ej. María Fernández" {...register("nombre")} />
            {errors.nombre ? <p className="text-body-sm text-destructive" role="alert">{errors.nombre.message}</p> : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-documento">Documento</Label>
            <Input id="f-documento" className="h-12 bg-muted" placeholder="Ej. 1.020.456.789" {...register("documento")} />
            {errors.documento ? <p className="text-body-sm text-destructive" role="alert">{errors.documento.message}</p> : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-telefono">Teléfono</Label>
            <Input id="f-telefono" className="h-12 bg-muted" placeholder="Ej. 300 123 4567" {...register("telefono")} />
            {errors.telefono ? <p className="text-body-sm text-destructive" role="alert">{errors.telefono.message}</p> : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-direccion">Dirección</Label>
            <Input id="f-direccion" className="h-12 bg-muted" placeholder="Ej. Cra 12 #34-56, Centro" {...register("direccion")} />
            {errors.direccion ? <p className="text-body-sm text-destructive" role="alert">{errors.direccion.message}</p> : null}
          </div>

          {tieneVariasRutas ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="f-ruta">Ruta</Label>
              <Controller
                control={control}
                name="rutaId"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger id="f-ruta" className="h-12 w-full bg-muted">
                      <SelectValue placeholder="Selecciona una ruta" />
                    </SelectTrigger>
                    <SelectContent>
                      {rutas.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.rutaId ? (
                <p className="text-body-sm text-destructive" role="alert">
                  {errors.rutaId.message}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Bloque colapsable "Agregar crédito" — mismo patrón que el Admin (3.4). */}
        <div className="mx-4 mt-4 flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col">
              <p className="text-caption text-muted-foreground uppercase">Crédito (opcional)</p>
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
              {abrirCredito ? "Ocultar" : "Agregar"}
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

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-credito-monto">Monto (COP)</Label>
                <Input
                  id="f-credito-monto"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="h-12 bg-muted"
                  placeholder="200000"
                  {...register("monto", { valueAsNumber: true })}
                />
                {errors.monto ? (
                  <p className="text-body-sm text-destructive" role="alert">
                    {errors.monto.message}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="f-credito-interes">% de interés</Label>
                  <Input
                    id="f-credito-interes"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    className="h-12 bg-muted"
                    placeholder="40"
                    {...register("interes", { valueAsNumber: true })}
                  />
                  {errors.interes ? (
                    <p className="text-body-sm text-destructive" role="alert">
                      {errors.interes.message}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="f-credito-dias">Días</Label>
                  <Input
                    id="f-credito-dias"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    className="h-12 bg-muted"
                    placeholder="30"
                    {...register("dias", { valueAsNumber: true })}
                  />
                  {errors.dias ? (
                    <p className="text-body-sm text-destructive" role="alert">
                      {errors.dias.message}
                    </p>
                  ) : null}
                </div>
              </div>

              <CuotasEstimadasInline
                monto={Number(values.monto ?? 0)}
                interes={Number(values.interes ?? 0)}
                dias={Number(values.dias ?? 0)}
              />
            </div>
          ) : null}
        </div>

        <div className="mt-auto p-4">
          <Button
            type="submit"
            size="lg"
            className="w-full bg-linear-to-r from-primary to-accent"
            loading={saving}
          >
            Guardar cliente
          </Button>
        </div>
    </form>
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
