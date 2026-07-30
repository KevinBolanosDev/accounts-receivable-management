"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createCreditoRequestSchema,
  updateCreditoRequestSchema,
  type ClienteListItem,
  type CobradorListItem,
  type CreateCreditoRequest,
  type RutaListItem,
} from "@repo/types";
import { toast } from "sonner";

import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

import {
  ClientePicker,
  FrecuenciaField,
  ProductoField,
} from "@/features/creditos/ui/CreditoFields";
import { CreditoCalculoPanel } from "@/features/creditos/ui/CreditoCalculoPanel";
import { useClientes, useUpdateCliente } from "@/features/clients/api/use-clientes";
import { useCobradores } from "@/features/collectors/api/use-cobradores";
import { useRutas } from "@/features/routes-collectors/api/use-rutas";

import { useCreateCredito, useCredito, useUpdateCredito } from "../api/use-creditos";

// DESIGN_SYSTEM.md §3.3 — pantalla Crear/Editar crédito (Admin, #9c / #10a
// "Editar"). Panel izquierdo "Datos del crédito" (cliente + producto texto
// libre + monto/interés/frecuencia/nº de cuotas) y panel derecho "Cálculo
// estimado" en vivo (nº de cuotas, valor de la cuota, total, duración, primeras
// cuotas). La cuota se DERIVA: cuota = (monto + interés)/cuotas — la frecuencia
// no cambia el monto de la cuota, solo cada cuánto vence. El producto es texto
// libre con autocompletado; el backend lo registra (upsert). En modo edición
// (`creditoId`), cliente y fecha de inicio no se pueden cambiar — solo
// producto/monto/interés/frecuencia/cuotas (`updateCreditoRequestSchema`), y el
// backend además bloquea la edición si el crédito ya tiene pagos (409).

const hoyISO = () => new Date().toISOString().slice(0, 10);

export interface CreateCreditoScreenProps {
  /** Si viene desde #5c con el cliente preseleccionado (#9c). */
  clienteIdInicial?: string;
  /** Si viene con id, la pantalla opera en modo edición (#10a "Editar"). */
  creditoId?: string;
}

export function CreateCreditoScreen({ clienteIdInicial, creditoId }: CreateCreditoScreenProps) {
  const isEdit = !!creditoId;
  const router = useRouter();
  const { data: credito } = useCredito(creditoId ?? "");
  const createCredito = useCreateCredito();
  const updateCredito = useUpdateCredito(creditoId ?? "");

  const form = useForm<CreateCreditoRequest>({
    resolver: zodResolver(
      isEdit ? updateCreditoRequestSchema : createCreditoRequestSchema,
    ) as never,
    mode: "onBlur",
    defaultValues: {
      clienteId: clienteIdInicial ?? "",
      producto: "",
      monto: undefined,
      interes: undefined,
      frecuencia: "DIARIO",
      cuotas: undefined,
      fechaInicio: hoyISO(),
    },
  });

  const { control, register, setValue, getValues, reset, formState } = form;

  useEffect(() => {
    if (clienteIdInicial) {
      setValue("clienteId", clienteIdInicial, { shouldValidate: true });
    }
  }, [clienteIdInicial, setValue]);

  // Alta: siempre visible (no solo cuando el cliente está "sin ruta") — un
  // cliente puede pasar de una ruta a otra igual, así que se puede asignar O
  // reasignar cobrador + ruta de una vez (ambos opcionales), evitando un
  // viaje aparte a "Editar cliente". El cobrador es solo un FILTRO de UI
  // (ayuda a elegir la ruta correcta sin saber de memoria a quién pertenece
  // cada una): lo que se persiste es siempre `cliente.rutaId`, nunca un
  // cobrador directo. `AsignacionRutaBlock` (abajo) monta con `key={cliente}`
  // — nunca "actualiza" sus Select tras el montaje con el valor precargado
  // (eso es lo que dejaba a Radix mostrando el placeholder pese al `value`
  // ya correcto: Select necesita nacer controlado con su valor final, no
  // montar vacío y recibir el valor real en un render posterior).
  const { data: clientes = [] } = useClientes();
  const { data: rutas = [] } = useRutas();
  const { data: cobradores = [] } = useCobradores();
  const watchedClienteId = useWatch({ control, name: "clienteId" });
  const updateCliente = useUpdateCliente(watchedClienteId || "");
  const clienteSeleccionado = clientes.find((c) => c.id === watchedClienteId) ?? null;
  const [rutaParaAsignar, setRutaParaAsignar] = useState<string | null>(null);

  // En edición, precargar el formulario con los datos reales del crédito.
  useEffect(() => {
    if (isEdit && credito) {
      reset({
        clienteId: credito.clienteId,
        producto: credito.producto,
        monto: credito.monto,
        interes: credito.interes,
        frecuencia: credito.frecuencia,
        cuotas: credito.cuotasTotal,
        fechaInicio: credito.fechaInicio.slice(0, 10),
      });
    }
  }, [isEdit, credito, reset]);

  const watched = useWatch({ control });

  const frecuencia = watched.frecuencia ?? "DIARIO";

  async function onSubmit(values: CreateCreditoRequest) {
    try {
      if (isEdit) {
        await updateCredito.mutateAsync({
          producto: values.producto,
          monto: values.monto,
          interes: values.interes,
          frecuencia: values.frecuencia,
          cuotas: values.cuotas,
        });
        toast.success("Crédito actualizado");
        router.push(`/admin/credits/${creditoId}`);
        return;
      }

      const nuevo = await createCredito.mutateAsync(values);

      const rutaActualDelCliente = clienteSeleccionado?.rutaId ?? null;
      if (rutaParaAsignar !== rutaActualDelCliente) {
        try {
          await updateCliente.mutateAsync({ rutaId: rutaParaAsignar });
        } catch {
          toast.error("El crédito se creó, pero no se pudo actualizar la ruta del cliente.");
        }
      }

      toast.success("Crédito creado");
      router.push(`/admin/credits/${nuevo.id}`);
    } catch (error) {
      // El backend puede rechazar por validación (400, ej. "cuotas" faltante
      // si el front apunta a una API con un contrato viejo), scoping (403) o
      // conflicto de código (409) — un fallback genérico esconde cuál de los
      // tres pasó y hace estos casos indiagnosticables desde la UI.
      const fallback = isEdit ? "No se pudo actualizar el crédito" : "No se pudo crear el crédito";
      toast.error(error instanceof ApiError ? error.message : fallback);
    }
  }

  const saving = createCredito.isPending || updateCredito.isPending;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <AdminPageHeader
        eyebrow={isEdit ? `Créditos / ${credito?.codigo ?? "…"} · Editar` : "Créditos / Nuevo"}
        title={isEdit ? "Editar crédito" : "Crear crédito"}
        subtitle={
          isEdit
            ? "El cliente y la fecha de inicio no se pueden cambiar."
            : "Asigna un crédito a un cliente. El valor de la cuota se calcula automáticamente."
        }
      />

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Panel izquierdo — Datos del crédito */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 rounded-lg">
            <p className="text-caption text-muted-foreground uppercase">Datos del crédito</p>

            <Controller
              control={control}
              name="clienteId"
              render={({ field }) => (
                <ClientePicker
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  error={formState.errors.clienteId?.message}
                  disabled={isEdit}
                />
              )}
            />

            {!isEdit && clienteSeleccionado ? (
              <AsignacionRutaBlock
                key={clienteSeleccionado.id}
                cliente={clienteSeleccionado}
                rutas={rutas}
                cobradores={cobradores}
                onChange={setRutaParaAsignar}
              />
            ) : null}

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
              <Controller
                control={control}
                name="frecuencia"
                render={({ field }) => (
                  <FrecuenciaField
                    value={field.value ?? "DIARIO"}
                    onChange={field.onChange}
                    error={formState.errors.frecuencia?.message}
                  />
                )}
              />
              <Field id="cuotas" label="N° de cuotas" error={formState.errors.cuotas?.message}>
                <Input
                  id="cuotas"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="30"
                  {...register("cuotas", { valueAsNumber: true })}
                />
              </Field>
              <Field
                id="fechaInicio"
                label="Fecha de inicio"
                error={formState.errors.fechaInicio?.message}
              >
                <Input id="fechaInicio" type="date" disabled={isEdit} {...register("fechaInicio")} />
              </Field>
            </div>
          </div>
        </div>
        {/* Panel derecho — Cálculo estimado */}
        <CreditoCalculoPanel
          monto={Number(watched.monto ?? 0)}
          interes={Number(watched.interes ?? 0)}
          cuotas={Number(watched.cuotas ?? 0)}
          frecuencia={frecuencia}
          fechaInicio={watched.fechaInicio ?? hoyISO()}
          className="self-start lg:sticky lg:top-6"
        />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {isEdit ? "Guardar cambios" : "Crear crédito"}
          </Button>
        </div>
      </div>
    </form>
  );
}

// Bloque "Asignar/reasignar ruta" del cliente elegido, con un Select de
// Cobrador que filtra el de Ruta. Se monta con `key={cliente.id}` desde el
// padre: el estado inicial se calcula UNA VEZ al montar (lazy `useState`),
// nunca vía un efecto que lo actualice después — un `<Select>` de Radix que
// nace sin valor y luego lo recibe por prop se queda mostrando el
// placeholder aunque el `value` ya sea correcto. `onChange` sincroniza el
// valor elegido hacia el padre (para el submit), incluido el valor inicial.
function AsignacionRutaBlock({
  cliente,
  rutas,
  cobradores,
  onChange,
}: {
  cliente: ClienteListItem;
  rutas: RutaListItem[];
  cobradores: CobradorListItem[];
  onChange: (rutaId: string | null) => void;
}) {
  const rutaInicial = cliente.rutaId
    ? (rutas.find((r) => r.id === cliente.rutaId) ?? null)
    : null;
  const [cobradorFiltro, setCobradorFiltro] = useState<string | null>(
    rutaInicial?.cobradorId ?? null,
  );
  const [rutaId, setRutaId] = useState<string | null>(cliente.rutaId ?? null);

  useEffect(() => {
    onChange(rutaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rutaId]);

  const rutasFiltradas = cobradorFiltro ? rutas.filter((r) => r.cobradorId === cobradorFiltro) : rutas;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-dashed border-border p-3">
      <p className="text-body-sm text-muted-foreground">
        {cliente.rutaId
          ? `${cliente.nombre} está en ${cliente.ruta?.nombre ?? "una ruta"} — puedes reasignarlo (opcional).`
          : `${cliente.nombre} no tiene ruta — puedes asignarle una ahora (opcional).`}{" "}
        Elegir un cobrador es solo para filtrar sus rutas.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cobrador-opcional">Cobrador</Label>
          <Select
            value={cobradorFiltro ?? ""}
            onValueChange={(v) => {
              setCobradorFiltro(v);
              setRutaId(null);
            }}
          >
            <SelectTrigger id="cobrador-opcional" className="w-full">
              <SelectValue placeholder="Cualquier cobrador" />
            </SelectTrigger>
            <SelectContent>
              {cobradores.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ruta-opcional">Ruta</Label>
          <Select value={rutaId ?? ""} onValueChange={(v) => setRutaId(v)}>
            <SelectTrigger id="ruta-opcional" className="w-full">
              <SelectValue placeholder="Sin ruta (puedes asignarla después)" />
            </SelectTrigger>
            <SelectContent>
              {rutasFiltradas.length === 0 ? (
                <p className="px-2 py-1.5 text-body-sm text-muted-foreground">
                  Ese cobrador no tiene rutas.
                </p>
              ) : (
                rutasFiltradas.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nombre}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
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



