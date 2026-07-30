"use client";

import Link from "next/link";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  createClienteRequestSchema,
  type ClienteDetail,
  type CreateClienteRequest,
  type FrecuenciaPago,
  type RutaListItem,
} from "@repo/types";
import { toast } from "sonner";
import { ChevronsUpDownIcon } from "lucide-react";

import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Skeleton } from "@/shared/ui/skeleton";
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
import { FrecuenciaField, ProductoField } from "@/features/creditos/ui/CreditoFields";
import { CreditoCalculoPanel } from "@/features/creditos/ui/CreditoCalculoPanel";

import { useCliente, useCreateCliente, useUpdateCliente } from "../api/use-clientes";
import { ClientFormPreview } from "./ClientFormPreview";
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

interface CreditoOpcional {
  abrirCredito: boolean;
  producto: string;
  monto?: number | undefined;
  interes?: number | undefined;
  frecuencia?: FrecuenciaPago | undefined;
  cuotas?: number | undefined;
}

type FormValues = CreateClienteRequest & CreditoOpcional;

const DEFAULTS: FormValues = {
  nombre: "",
  telefono: "",
  documento: "",
  direccion: "",
  // `null` = "Sin ruta", el mismo valor que emite el Select al elegir esa
  // opción. Con `""` el formulario arrancaba en un estado que el Select ya
  // pintaba como "Sin ruta" pero que se enviaba como un id de ruta vacío:
  // quien no tocaba el desplegable creaba el cliente con un `rutaId` inválido.
  rutaId: null,
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
};

// Contenedor: espera a que estén TODAS las queries que alimentan los valores
// iniciales antes de montar el formulario, y decide la identidad del form con
// `key`. El cuerpo recibe los datos ya resueltos.
//
// Antes esto era un `reset()` dentro de un `useEffect` que dependía del objeto
// `cliente`. TanStack devuelve una referencia nueva en cada refetch y
// `refetchOnWindowFocus` está activo, así que volver a la pestaña re-disparaba
// el efecto y PISABA lo que el usuario estuviera escribiendo. Y como el reset
// podía correr antes de que llegaran las rutas, el <Select> se quedaba en el
// placeholder (Radix pinta el placeholder si el `value` no tiene `SelectItem`):
// eso era el "no precarga la ruta al editar".
export function ClientFormScreen({ clienteId }: { clienteId?: string }) {
  const isEdit = !!clienteId;
  const { data: cliente, isLoading: loadingCliente, isError } = useCliente(clienteId ?? "");
  const { data: rutas = [], isLoading: loadingRutas } = useRutas();

  // Solo el alta se pinta de inmediato: no tiene nada que precargar y el
  // cobrador la usa en la calle, donde cada segundo cuenta.
  if (isEdit && (loadingCliente || loadingRutas)) {
    return (
      <>
        <AdminPageHeader eyebrow="Clientes" title="Editar cliente" />
        <div className="p-4 sm:p-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </>
    );
  }

  if (isEdit && (isError || !cliente)) {
    return (
      <>
        <AdminPageHeader eyebrow="Clientes" title="Editar cliente" />
        <div className="flex flex-col items-center gap-4 p-4 sm:p-6">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm font-medium">Este cliente no existe o fue eliminado</p>
            <p className="text-caption text-muted-foreground">No hay nada que editar.</p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/admin/clients">Volver a Clientes</Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <ClientFormBody
      // Remonta el formulario si cambia la entidad. Es lo que reemplaza al
      // `reset` en efecto: los valores iniciales se calculan una sola vez.
      key={cliente?.id ?? "new"}
      cliente={cliente ?? null}
      rutas={rutas}
      clienteId={clienteId}
    />
  );
}

function ClientFormBody({
  cliente,
  rutas,
  clienteId,
}: {
  cliente: ClienteDetail | null;
  rutas: RutaListItem[];
  clienteId?: string;
}) {
  const isEdit = !!clienteId;
  const router = useRouter();
  const createCliente = useCreateCliente();
  const updateCliente = useUpdateCliente(clienteId ?? "");
  const createCredito = useCreateCredito();

  const form = useForm<FormValues>({
    // `raw: true` — sin esto, zodResolver STRIPEA del resultado cualquier
    // campo que no esté en createClienteRequestSchema (comportamiento por
    // defecto de z.object().parse()), así que abrirCredito/producto/monto/
    // interes/cuotas nunca llegarían a onSubmit aunque el usuario los llene
    // (bug preexistente: el crédito opcional nunca se creaba).
    resolver: zodResolver(createClienteRequestSchema, undefined, { raw: true }) as never,
    mode: "onBlur",
    defaultValues: cliente
      ? {
          ...DEFAULTS,
          nombre: cliente.nombre,
          telefono: cliente.telefono,
          documento: cliente.documento,
          direccion: cliente.direccion,
          rutaId: cliente.rutaId ?? null,
          fotoDocumentoFrentePath: cliente.fotoDocumentoFrentePath,
          fotoDocumentoReversoPath: cliente.fotoDocumentoReversoPath,
          contactoNombre: cliente.contactoNombre ?? "",
          contactoTelefono: cliente.contactoTelefono ?? "",
        }
      : DEFAULTS,
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors },
    setError,
  } = form;

  // Cuenta cuántos de los 2 uploaders están subiendo ahora mismo, para
  // bloquear el submit mientras cualquiera esté en curso: antes el guardado
  // no esperaba nada, así que guardar rápido dejaba la foto en `null` pese a
  // que la subida seguía en progreso en segundo plano.
  const [uploadingCount, setUploadingCount] = useState(0);
  function handleUploadingChange(uploading: boolean) {
    setUploadingCount((count) => count + (uploading ? 1 : -1));
  }

  const abrirCredito = useWatch({ control, name: "abrirCredito" });
  const values = useWatch({ control });
  // Fallback al nombre que ya trae el propio cliente: si `useRutas` falla o
  // devuelve una lista sin esa ruta, la vista previa diría "Sin ruta" sobre un
  // cliente que sí la tiene.
  const rutaNombre =
    rutas.find((route) => route.id === values.rutaId)?.nombre ??
    (values.rutaId && values.rutaId === cliente?.rutaId ? cliente?.ruta?.nombre : null) ??
    "Sin ruta";

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
      if (isEdit) {
        await updateCliente.mutateAsync({
          nombre: v.nombre,
          telefono: v.telefono,
          documento: v.documento,
          direccion: v.direccion,
          rutaId: v.rutaId,
          fotoDocumentoFrentePath: v.fotoDocumentoFrentePath ?? null,
          fotoDocumentoReversoPath: v.fotoDocumentoReversoPath ?? null,
          // Explícitos y normalizando "" → null: en un update, `undefined`
          // significa "no tocar", así que omitirlos haría imposible borrar un
          // contacto ya guardado.
          contactoNombre: v.contactoNombre?.trim() || null,
          contactoTelefono: v.contactoTelefono?.trim() || null,
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
    } catch (error) {
      // El backend distingue casos accionables (documento duplicado → 409,
      // ruta inexistente → 404); un texto genérico los borra todos.
      toast.error(error instanceof ApiError ? error.message : "No se pudo guardar el cliente");
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
        <div className="flex min-w-0 flex-col gap-6">
          {/* Sin card alrededor del formulario: los campos ya se leen como un
              bloque por su propio ritmo, y en móvil la card solo añadía un
              borde y 24px de padding contra los bordes de la pantalla. */}
          <div className="flex flex-col gap-4">
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

            {/* Contacto de referencia: a quién llamar si no se ubica al
                cliente. El contrato y el backend ya lo soportaban, y el
                cobrador ya lo ve en su pantalla de cobro, pero ningún
                formulario permitía escribirlo — siempre llegaba vacío. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="contactoNombre"
                label="Contacto de referencia (opcional)"
                error={errors.contactoNombre?.message}
              >
                <Input
                  id="contactoNombre"
                  placeholder="Nombre de un familiar o vecino"
                  {...register("contactoNombre")}
                />
              </Field>
              <Field
                id="contactoTelefono"
                label="Teléfono del contacto (opcional)"
                error={errors.contactoTelefono?.message}
              >
                <Input
                  id="contactoTelefono"
                  inputMode="tel"
                  placeholder="300 000 0000"
                  {...register("contactoTelefono")}
                />
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Foto del documento</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <DocumentUploader
                  capture
                  placeholder="Frente"
                  value={values.fotoDocumentoFrentePath ?? null}
                  previewUrl={cliente?.fotoDocumentoFrenteUrl}
                  onChange={(path) => setValue("fotoDocumentoFrentePath", path)}
                  onUploadingChange={handleUploadingChange}
                />
                <DocumentUploader
                  capture
                  placeholder="Reverso"
                  value={values.fotoDocumentoReversoPath ?? null}
                  previewUrl={cliente?.fotoDocumentoReversoUrl}
                  onChange={(path) => setValue("fotoDocumentoReversoPath", path)}
                  onUploadingChange={handleUploadingChange}
                />
              </div>
            </div>
          </div>

          {/* === Sub-fase 3.4 — bloque "Agregar crédito" opcional ============ */}
          {!isEdit ? (
            <div className="flex flex-col border-t gap-3 pt-3">
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
                    <Field id="credito-cuotas" label="N° de cuotas" error={errors.cuotas?.message}>
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
                        error={errors.frecuencia?.message}
                      />
                    )}
                  />

                  <CreditoCalculoPanel
                    monto={Number(values.monto ?? 0)}
                    interes={Number(values.interes ?? 0)}
                    cuotas={Number(values.cuotas ?? 0)}
                    frecuencia={values.frecuencia ?? "DIARIO"}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={saving}
              disabled={uploadingCount > 0}
              title={uploadingCount > 0 ? "Espera a que terminen de subirse las fotos." : undefined}
            >
              {uploadingCount > 0
                ? "Esperando la foto…"
                : isEdit
                  ? "Guardar cambios"
                  : "Guardar cliente"}
            </Button>
          </div>
        </div>

        {/* La vista previa repite lo que el usuario acaba de escribir dos
            pantallas más arriba: en móvil es scroll muerto entre el último
            campo y el botón de guardar. Solo desde `lg`, donde ocupa una
            columna propia y sí aporta contexto. */}
        <div className="hidden lg:block">
          <ClientFormPreview values={values} rutaNombre={rutaNombre} cliente={cliente} />
        </div>
      </form>
    </>
  );
}
