"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { createRutaRequestSchema } from "@repo/types";
import { useCobradores } from "@/features/collectors/api/use-cobradores";
import { useClientes } from "@/features/clients/api/use-clientes";
import { CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { formatCurrency } from "@/shared/lib/format-currency";
import { getInitials } from "@/shared/lib/initials";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/ui/command";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { ProgressBar } from "@/shared/ui/progress-bar";
import { Skeleton } from "@/shared/ui/skeleton";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

import { rutasService } from "../api/rutas-service";
import {
  useAssignClientesToRuta,
  useCreateRuta,
  useRuta,
  useUnassignClienteFromRuta,
  useUpdateRuta,
} from "../api/use-rutas";

interface RouteFormValues {
  nombre: string;
  cobradorId?: string | null;
}

interface ClienteResumen {
  id: string;
  nombre: string;
  documento: string;
  /** Ruta actual del cliente, si tiene una — para avisar que se lo va a reasignar. */
  rutaNombre?: string | null;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-caption text-muted-foreground uppercase">{children}</p>;
}

function CobradorPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: collectors = [] } = useCobradores();
  const selected = collectors.find((c) => c.id === value) ?? null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
      {selected ? (
        <>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
            {getInitials(selected.nombre)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{selected.nombre}</span>
            <span className="truncate text-caption text-muted-foreground">Tel. {selected.telefono}</span>
          </div>
        </>
      ) : (
        <span className="flex-1 text-sm text-muted-foreground">Sin cobrador asignado</span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="text-primary">
            {selected ? "Cambiar" : "Asignar"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-0">
          <Command>
            <CommandInput placeholder="Buscar cobrador..." />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                 {collectors.map((collector) => (
                   <CommandItem
                     key={collector.id}
                     value={collector.nombre}
                     onSelect={() => {
                       onChange(collector.id);
                       setOpen(false);
                     }}
                   >
                     <CheckIcon className={value === collector.id ? "opacity-100" : "opacity-0"} />
                     {collector.nombre}
                   </CommandItem>
                 ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Bloque "Clientes de la ruta": lista los ya asignados (con "Quitar") + un
// picker para agregar clientes — incluye clientes de OTRAS rutas (se
// reasignan, no hace falta que estén "sin ruta" primero) mostrando su ruta
// actual como referencia. En edición muta contra el backend de inmediato
// (§3 — cierre de Fase 3); en alta todavía no hay `rutaId`, así que solo
// acumula localmente y el padre los asigna tras crear la ruta.
function ClientesRutaSection({
  asignados,
  disponibles,
  onAdd,
  onRemove,
  adding,
  removingId,
}: {
  asignados: ClienteResumen[];
  disponibles: ClienteResumen[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  adding?: boolean;
  removingId?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Clientes de la ruta</SectionLabel>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="text-primary" loading={adding}>
              Agregar cliente
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <Command>
              <CommandInput placeholder="Buscar cliente..." />
              <CommandList>
                <CommandEmpty>No hay más clientes para agregar.</CommandEmpty>
                <CommandGroup>
                  {disponibles.map((cliente) => (
                    <CommandItem
                      key={cliente.id}
                      value={`${cliente.nombre} ${cliente.documento}`}
                      onSelect={() => {
                        onAdd(cliente.id);
                        setOpen(false);
                      }}
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
                        {getInitials(cliente.nombre)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{cliente.nombre}</span>
                        <span className="truncate text-caption text-muted-foreground">
                          {cliente.rutaNombre ? `Actualmente en ${cliente.rutaNombre}` : "Sin ruta"}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-background">
        {asignados.length === 0 ? (
          <p className="p-4 text-body-sm text-muted-foreground">
            Todavía no hay clientes asignados a esta ruta.
          </p>
        ) : (
          asignados.map((cliente) => (
            <div key={cliente.id} className="flex items-center gap-3 p-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                {getInitials(cliente.nombre)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{cliente.nombre}</span>
                <span className="truncate text-caption text-muted-foreground">
                  {cliente.documento}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Quitar ${cliente.nombre} de la ruta`}
                loading={removingId === cliente.id}
                onClick={() => onRemove(cliente.id)}
              >
                <XIcon />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function RouteFormScreen({ rutaId }: { rutaId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = !!rutaId;
  const { data: ruta, isLoading: loadingRuta } = useRuta(rutaId ?? "");
  const createRuta = useCreateRuta();
  const updateRuta = useUpdateRuta(rutaId ?? "");
  const assignClientes = useAssignClientesToRuta(rutaId ?? "");
  const unassignCliente = useUnassignClienteFromRuta(rutaId ?? "");
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Alta: no hay `rutaId` todavía, así que los clientes elegidos se acumulan
  // aquí y se asignan en bloque justo después de crear la ruta.
  const [pendingClienteIds, setPendingClienteIds] = useState<string[]>([]);
  const { data: todosLosClientes = [] } = useClientes();

  const form = useForm<RouteFormValues>({
    resolver: zodResolver(createRutaRequestSchema),
    mode: "onBlur",
    defaultValues: { nombre: "", cobradorId: null },
  });
  const { register, handleSubmit, control, setValue, reset } = form;

  // Depende del ID, NO del objeto `ruta`. Con el objeto, cada asignación de
  // cliente hacía `setQueryData` (ver `useAssignClientesToRuta`) → referencia
  // nueva → este efecto volvía a correr → el nombre que el usuario acababa de
  // escribir se revertía al del servidor.
  //
  // Aquí no se usa el patrón contenedor+`key` de `ClientFormScreen` porque
  // `ruta` alimenta además las métricas y la lista de clientes asignados, que
  // SÍ deben re-renderizar con cada mutación. Lo que no debe reaccionar es el
  // formulario, y eso es exactamente lo que acota la dependencia por id.
  useEffect(() => {
    if (ruta) {
      reset({ nombre: ruta.nombre, cobradorId: ruta.cobradorId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta?.id, reset]);

  const nombre = useWatch({ control, name: "nombre" });
  const cobradorId = useWatch({ control, name: "cobradorId" }) ?? null;
  const { data: collectors = [] } = useCobradores();
  const cobrador = collectors.find((collector) => collector.id === cobradorId) ?? null;

  // Métricas de la vista previa: en edición, las de la ruta; en alta, ceros.
  const clientesCount = ruta?.clientesCount ?? 0;
  const cobradoHoy = ruta?.cobradoHoy ?? 0;
  const avance = ruta?.avanceDelDia ?? 0;
  const abierta = (ruta?.estadoDia ?? "cerrada") === "abierta";

  // El picker ofrece TODOS los clientes (no solo "sin ruta"): elegir uno que
  // ya está en otra ruta lo reasigna aquí (el backend no lo restringe).
  const asignadosIds = isEdit
    ? new Set((ruta?.clientes ?? []).map((c) => c.id))
    : new Set(pendingClienteIds);
  const asignados: ClienteResumen[] = isEdit
    ? (ruta?.clientes ?? []).map((c) => ({
        id: c.id,
        nombre: c.nombre,
        documento: c.documento,
        rutaNombre: c.ruta?.nombre ?? null,
      }))
    : todosLosClientes
        .filter((c) => asignadosIds.has(c.id))
        .map((c) => ({
          id: c.id,
          nombre: c.nombre,
          documento: c.documento,
          rutaNombre: c.ruta?.nombre ?? null,
        }));
  const disponibles: ClienteResumen[] = todosLosClientes
    .filter((c) => !asignadosIds.has(c.id))
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      documento: c.documento,
      rutaNombre: c.ruta?.nombre ?? null,
    }));

  function handleAddCliente(clienteId: string) {
    if (isEdit) {
      assignClientes.mutate([clienteId], {
        onError: () => toast.error("No se pudo agregar el cliente."),
      });
    } else {
      setPendingClienteIds((ids) => (ids.includes(clienteId) ? ids : [...ids, clienteId]));
    }
  }

  function handleRemoveCliente(clienteId: string) {
    if (isEdit) {
      setRemovingId(clienteId);
      unassignCliente.mutate(clienteId, {
        onSettled: () => setRemovingId(null),
        onError: () => toast.error("No se pudo quitar el cliente."),
      });
    } else {
      setPendingClienteIds((ids) => ids.filter((id) => id !== clienteId));
    }
  }

  async function onSubmit(values: RouteFormValues) {
    try {
      if (isEdit) {
        await updateRuta.mutateAsync({ nombre: values.nombre, cobradorId: values.cobradorId });
        toast.success("Ruta actualizada");
      } else {
        // `activa` ya no se edita desde este formulario (se movió a la tabla
        // de Rutas) — toda ruta nueva nace activa.
        const creada = await createRuta.mutateAsync({
          nombre: values.nombre,
          cobradorId: values.cobradorId,
          activa: true,
        });
        if (pendingClienteIds.length > 0) {
          try {
            await rutasService.assignClientes(creada.id, pendingClienteIds);
            queryClient.invalidateQueries({ queryKey: ["clientes"] });
          } catch {
            toast.error("La ruta se creó, pero algunos clientes no se pudieron asignar.");
          }
        }
        toast.success("Ruta creada");
      }
      router.push("/admin/routes-collectors");
    } catch {
      toast.error("No se pudo guardar la ruta");
    }
  }

  const saving = createRuta.isPending || updateRuta.isPending;

  // En edición se espera a la ruta antes de pintar: si no, el formulario
  // aparece vacío y "salta" a los valores reales un instante después, y lo que
  // el usuario haya alcanzado a escribir en esa ventana se pierde.
  if (isEdit && loadingRuta) {
    return (
      <>
        <AdminPageHeader eyebrow="Rutas" title="Editar ruta" />
        <div className="p-4 sm:p-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        eyebrow={isEdit ? `Rutas / ${ruta?.nombre ?? "Ruta"} · Editar` : "Rutas / Nueva"}
        title={isEdit ? "Editar ruta" : "Nueva ruta"}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Formulario — sin card: en móvil el borde y sus 24px de padding
              solo comen ancho contra los bordes de la pantalla. */}
          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-col gap-3">
              <SectionLabel>Datos de la ruta</SectionLabel>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="nombre" className="text-sm font-medium">
                  Nombre de la ruta
                </label>
                <Input id="nombre" placeholder="Ej. Ruta 3 · Centro" {...register("nombre")} />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <SectionLabel>Cobrador asignado</SectionLabel>
              <CobradorPicker value={cobradorId} onChange={(id) => setValue("cobradorId", id)} />
            </div>

            <ClientesRutaSection
              asignados={asignados}
              disponibles={disponibles}
              onAdd={handleAddCliente}
              onRemove={handleRemoveCliente}
              adding={assignClientes.isPending}
              removingId={removingId}
            />
          </div>

          {/* Vista previa en vivo. Solo desde `lg`: en móvil repite, dos
              pantallas más abajo, lo que el usuario acaba de escribir, y aleja
              el botón de guardar sin aportar nada. */}
          <div className="hidden flex-col gap-3 lg:flex">
            <SectionLabel>Vista previa</SectionLabel>
            <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col">
                  <span className="font-semibold">{nombre || "Nombre de la ruta"}</span>
                  <span className="text-caption text-muted-foreground">
                    {isEdit ? clientesCount : asignados.length} clientes
                  </span>
                </div>
                <Badge status={abierta ? "ruta-abierta" : "ruta-cerrada"}>
                  {abierta ? "Abierta" : "Cerrada"}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
                  {cobrador ? getInitials(cobrador.nombre) : "—"}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {cobrador?.nombre ?? "Sin cobrador"}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-amount font-semibold tabular-nums">
                    {formatCurrency(cobradoHoy)}
                  </span>
                  <span className={cn("text-sm font-medium tabular-nums", avance >= 100 ? "text-success" : "text-accent")}>
                    {avance}%
                  </span>
                </div>
                <ProgressBar value={avance} />
              </div>
            </div>
            <p className="text-caption text-muted-foreground">
              Así se verá la ruta en la lista. El avance del día se calcula con los cobros
              registrados.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {isEdit ? "Guardar cambios" : "Crear ruta"}
          </Button>
        </div>
      </form>
    </>
  );
}
