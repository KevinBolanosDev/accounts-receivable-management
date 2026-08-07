"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftIcon, ChevronsUpDownIcon, CopyIcon } from "lucide-react";
import {
  createClienteRequestSchema,
  type CreateClienteRequest,
  type FrecuenciaPago,
} from "@repo/types";
import { toast } from "sonner";

import { FRECUENCIA_OPTIONS } from "@/entities/credit";
import { useCreateCredito } from "@/features/creditos/api/use-creditos";
import { CreditoCalculoPanel } from "@/features/creditos/ui/CreditoCalculoPanel";
import { ProductoField } from "@/features/creditos/ui/CreditoFields";
import { useRutas } from "@/features/routes-collectors/api/use-rutas";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { PhoneInput } from "@/shared/ui/phone-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";

import { useCreateCliente, useGenerateClientAccess } from "../api/use-clientes";
import { DocumentUploader } from "./DocumentUploader";

// El `<input type="date">` emite "YYYY-MM-DD"; es el mismo formato que espera
// `createCreditoRequestSchema.fechaInicio` y el que `parseFechaInicio` ancla al
// mediodía UTC para que no se corra un día al formatear en America/Bogota.
const hoyISO = () => new Date().toISOString().slice(0, 10);

const RUTA_CORTA = "Mi ruta";

interface CreditoOpcional {
  abrirCredito: boolean;
  producto: string;
  monto?: number | undefined;
  interes?: number | undefined;
  frecuencia?: FrecuenciaPago | undefined;
  cuotas?: number | undefined;
  fechaInicio?: string | undefined;
}

interface AccesoOpcional {
  crearAcceso: boolean;
}

type FormValues = CreateClienteRequest & CreditoOpcional & AccesoOpcional;

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
  const generateAccess = useGenerateClientAccess();
  const { data: rutas = [] } = useRutas();
  const activeRoute = rutas[0];
  const tieneVariasRutas = rutas.length > 1;
  const [tempPassword, setTempPassword] = useState<string | null>(null);

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
    // interes/cuotas nunca llegarían a onSubmit aunque el usuario los llene.
    resolver: zodResolver(createClienteRequestSchema, undefined, { raw: true }) as never,
    defaultValues: {
      nombre: "",
      telefono: "",
      documento: "",
      direccion: "",
      // `null` y no `""`: la cadena vacía pasa el schema pero llega a Prisma
      // como FK inválida (mismo bug que ya se corrigió en `ClientFormScreen`).
      rutaId: activeRoute?.id ?? null,
      fotoDocumentoFrentePath: null,
      fotoDocumentoReversoPath: null,
      contactoNombre: "",
      contactoTelefono: "",
      abrirCredito: false,
      producto: "",
      monto: undefined,
      interes: undefined,
      frecuencia: "DIARIO",
      cuotas: undefined,
      fechaInicio: hoyISO(),
      crearAcceso: false,
    },
  });

  const fotos = useWatch({ control, name: ["fotoDocumentoFrentePath", "fotoDocumentoReversoPath"] });
  const abrirCredito = useWatch({ control, name: "abrirCredito" });
  const values = useWatch({ control });
  // Mismo motivo que en `ClientFormScreen`: sin esto, guardar mientras la foto
  // todavía sube deja el cliente creado con la foto en `null`.
  const [uploadingCount, setUploadingCount] = useState(0);
  function handleUploadingChange(uploading: boolean) {
    setUploadingCount((count) => count + (uploading ? 1 : -1));
  }
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
      if (typeof v.cuotas !== "number" || v.cuotas <= 0) {
        fieldErrors.push({ name: "cuotas", message: "Las cuotas deben ser mayor a 0." });
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
        fotoDocumentoFrentePath: v.fotoDocumentoFrentePath ?? null,
        fotoDocumentoReversoPath: v.fotoDocumentoReversoPath ?? null,
        contactoNombre: v.contactoNombre?.trim() || null,
        contactoTelefono: v.contactoTelefono?.trim() || null,
      });

      if (
        v.abrirCredito &&
        v.producto?.trim() &&
        typeof v.monto === "number" &&
        typeof v.interes === "number" &&
        typeof v.cuotas === "number"
      ) {
        try {
          await createCredito.mutateAsync({
            clienteId: clienteCreado.id,
            producto: v.producto.trim(),
            monto: v.monto,
            interes: v.interes,
            frecuencia: v.frecuencia ?? "DIARIO",
            cuotas: v.cuotas,
            fechaInicio: v.fechaInicio || hoyISO(),
          });
          toast.success(
            clienteCreado.reactivado
              ? "Cliente reactivado y crédito creado"
              : "Cliente y crédito creados",
          );
        } catch (error) {
          const motivo = error instanceof ApiError ? error.message : "error desconocido";
          toast.error(
            `Cliente creado (${clienteCreado.id}); el crédito no se guardó (${motivo}) — puedes crearlo desde su detalle.`,
          );
        }
      // `reactivado` = el documento ya era de un cliente mío dado de baja y el
      // alta lo revivió en vez de crear uno nuevo. Hay que decirlo: vuelven sus
      // créditos y su historial de pagos, y sin aviso eso se lee como un bug.
      } else if (clienteCreado.reactivado) {
        toast.success("Cliente reactivado", {
          description:
            "Ya estaba registrado con ese documento y había sido dado de baja. Se restauraron sus créditos y su historial.",
        });
      } else {
        toast.success("Cliente creado");
      }

      if (v.crearAcceso) {
        try {
          const access = await generateAccess.mutateAsync(clienteCreado.id);
          // No navegamos todavía — el dialog de la password navega al cerrarse
          // (el staff necesita copiarla antes de perder la pantalla).
          setTempPassword(access.temporaryPassword);
          return;
        } catch (error) {
          const motivo = error instanceof ApiError ? error.message : "error desconocido";
          toast.error(
            `Cliente creado, pero no se pudo generar el acceso al portal (${motivo}). Puedes generarlo luego desde su detalle.`,
          );
        }
      }

      router.push("/collector/clients");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo guardar el cliente");
    }
  }

  function closeTempPasswordDialog() {
    setTempPassword(null);
    router.push("/collector/clients");
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
              onChange={(path) => setValue("fotoDocumentoFrentePath", path)}
              onUploadingChange={handleUploadingChange}
            />
            <DocumentUploader
              capture
              placeholder="Reverso"
              value={fotos[1] ?? null}
              onChange={(path) => setValue("fotoDocumentoReversoPath", path)}
              onUploadingChange={handleUploadingChange}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-nombre">Nombre completo</Label>
            <Input id="f-nombre" className="h-12 bg-muted" placeholder="Ej. María Fernández" {...register("nombre")} />
            {errors.nombre ? <p className="text-body-sm text-destructive-strong" role="alert">{errors.nombre.message}</p> : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-documento">Documento</Label>
            <Input id="f-documento" className="h-12 bg-muted" placeholder="Ej. 1.020.456.789" {...register("documento")} />
            {errors.documento ? <p className="text-body-sm text-destructive-strong" role="alert">{errors.documento.message}</p> : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-telefono">Teléfono</Label>
            <Controller
              control={control}
              name="telefono"
              render={({ field }) => (
                <PhoneInput
                  id="f-telefono"
                  className="h-12 bg-muted"
                  placeholder="Ej. 300 123 4567"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
            {errors.telefono ? <p className="text-body-sm text-destructive-strong" role="alert">{errors.telefono.message}</p> : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-direccion">Dirección</Label>
            <Input id="f-direccion" className="h-12 bg-muted" placeholder="Ej. Cra 12 #34-56, Centro" {...register("direccion")} />
            {errors.direccion ? <p className="text-body-sm text-destructive-strong" role="alert">{errors.direccion.message}</p> : null}
          </div>

          {/* El cobrador en campo es justamente quien recoge el contacto de
              referencia; ambos opcionales para no alargar el alta rápida. */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-contacto-nombre">Contacto de referencia (opcional)</Label>
            <Input
              id="f-contacto-nombre"
              className="h-12 bg-muted"
              placeholder="Ej. un familiar o vecino"
              {...register("contactoNombre")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-contacto-telefono">Teléfono del contacto (opcional)</Label>
            <Controller
              control={control}
              name="contactoTelefono"
              render={({ field }) => (
                <PhoneInput
                  id="f-contacto-telefono"
                  className="h-12 bg-muted"
                  placeholder="Ej. 300 123 4567"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
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
                <p className="text-body-sm text-destructive-strong" role="alert">
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
                  <p className="text-body-sm text-destructive-strong" role="alert">
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
                    <p className="text-body-sm text-destructive-strong" role="alert">
                      {errors.interes.message}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="f-credito-cuotas">N° de cuotas</Label>
                  <Input
                    id="f-credito-cuotas"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    className="h-12 bg-muted"
                    placeholder="30"
                    {...register("cuotas", { valueAsNumber: true })}
                  />
                  {errors.cuotas ? (
                    <p className="text-body-sm text-destructive-strong" role="alert">
                      {errors.cuotas.message}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-credito-frecuencia">Frecuencia de pago</Label>
                <Controller
                  control={control}
                  name="frecuencia"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? "DIARIO"}
                      onValueChange={(v) => field.onChange(v as FrecuenciaPago)}
                    >
                      <SelectTrigger id="f-credito-frecuencia" className="h-12 w-full bg-muted">
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
                  )}
                />
              </div>

              {/* La fecha de inicio faltaba acá y sí estaba en "Crear crédito":
                  el crédito nacía siempre hoy, sin forma de registrar uno
                  otorgado ayer. */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-credito-fecha-inicio">Fecha de inicio</Label>
                <Input
                  id="f-credito-fecha-inicio"
                  type="date"
                  className="h-12 bg-muted"
                  {...register("fechaInicio")}
                />
                {errors.fechaInicio ? (
                  <p className="text-body-sm text-destructive-strong" role="alert">
                    {errors.fechaInicio.message}
                  </p>
                ) : null}
              </div>

              <CreditoCalculoPanel
                monto={Number(values.monto ?? 0)}
                interes={Number(values.interes ?? 0)}
                cuotas={Number(values.cuotas ?? 0)}
                frecuencia={values.frecuencia ?? "DIARIO"}
                fechaInicio={values.fechaInicio || hoyISO()}
              />
            </div>
          ) : null}
        </div>

        {/* Fase 4.14 — acceso opcional al portal desde el alta en campo. */}
        <div className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-2xl bg-card p-5 shadow-lg">
          <div className="flex flex-col">
            <Label htmlFor="f-crear-acceso">Crear acceso al portal</Label>
            <p className="text-body-sm text-muted-foreground">
              Genera una contraseña temporal para que el cliente consulte su crédito.
            </p>
          </div>
          <Controller
            control={control}
            name="crearAcceso"
            render={({ field }) => (
              <Switch
                id="f-crear-acceso"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>

        <div className="mt-auto p-4">
          <Button
            type="submit"
            size="lg"
            className="w-full bg-linear-to-r from-primary to-accent"
            loading={saving}
            disabled={uploadingCount > 0}
          >
            {uploadingCount > 0 ? "Esperando la foto…" : "Guardar cliente"}
          </Button>
        </div>

      <Dialog
        open={!!tempPassword}
        onOpenChange={(open) => !open && closeTempPasswordDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acceso al portal creado</DialogTitle>
            <DialogDescription>
              Compártela con el cliente fuera de la app. No se vuelve a mostrar.
            </DialogDescription>
          </DialogHeader>
          {tempPassword ? (
            <div className="flex items-center gap-2">
              <Input readOnly value={tempPassword} className="font-mono" />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Copiar contraseña"
                onClick={() => {
                  void navigator.clipboard.writeText(tempPassword);
                  toast.success("Copiada al portapapeles");
                }}
              >
                <CopyIcon />
              </Button>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={closeTempPasswordDialog}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
