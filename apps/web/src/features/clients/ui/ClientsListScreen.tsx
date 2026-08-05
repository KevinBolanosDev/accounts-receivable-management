"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRightIcon, PlusIcon, RotateCcwIcon, SearchIcon } from "lucide-react";
import type { ClienteDetail, ClienteListItem, EstadoCliente } from "@repo/types";

import {
  ESTADO_CLIENTE_FILTER_LABEL,
  ESTADO_CLIENTE_LABEL_SHORT,
  ESTADO_CLIENTE_ORDER,
  getInitials,
} from "@/entities/client";
import { formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { FilterChips } from "@/shared/ui/filter-chips";
import { Input } from "@/shared/ui/input";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { useRutas } from "@/features/routes-collectors/api/use-rutas";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";
import { TabsList, TabsRoot, TabsTrigger } from "@/shared/ui/tabs";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

import { useCliente, useClientes, useClientesSummary } from "../api/use-clientes";
import { ReactivateClientDialog } from "./ReactivateClientDialog";

/** "all" = sin filtro de estado. Radix Select no admite `value=""`. */
type EstadoFiltro = "all" | EstadoCliente;

/**
 * Fila de un cliente dado de baja: sin chevron ni link (no hay detalle que
 * abrir — `GET /clients/:id` sin `estado=todos` le da 404), solo el dato
 * mínimo y la acción de vuelta.
 */
function InactiveClientRow({
  cliente,
  onReactivate,
}: {
  cliente: ClienteListItem;
  onReactivate: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
        {getInitials(cliente.nombre)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{cliente.nombre}</span>
        <span className="truncate text-caption text-muted-foreground">{cliente.documento}</span>
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={onReactivate}>
        <RotateCcwIcon />
        Reactivar
      </Button>
    </div>
  );
}

function rutaCorta(nombre: string | undefined): string {
  return nombre?.split("·")[0]?.trim() ?? "Sin ruta";
}

// La fila tiene dos comportamientos según el ancho: en escritorio SELECCIONA
// (alimenta el panel de preview de la derecha) y en móvil NAVEGA al detalle,
// donde no hay panel que alimentar. En vez de dos componentes, el `<button>`
// de selección lleva encima un stretched link `lg:hidden` — el mismo patrón de
// `entities/client/ui/ClientCard`. Anidar el `<button>` dentro de un `<a>`
// sería HTML inválido y además navegaría al seleccionar.
function ClientRow({
  cliente,
  selected,
  onSelect,
}: {
  cliente: ClienteListItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="relative">
      <Link
        href={`/admin/clients/${cliente.id}`}
        className="absolute inset-0 z-10 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none lg:hidden"
      >
        <span className="sr-only">Ver detalle de {cliente.nombre}</span>
      </Link>

      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors",
          selected
            ? "border-primary bg-primary/10 lg:border-primary"
            : "border-transparent hover:bg-muted",
          // En móvil la selección no se pinta: la fila navega, no selecciona.
          selected && "max-lg:border-transparent max-lg:bg-transparent",
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
          {getInitials(cliente.nombre)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{cliente.nombre}</span>
          <span className="truncate text-caption text-muted-foreground">
            {rutaCorta(cliente.ruta?.nombre)} · {formatCurrency(cliente.saldoPendiente ?? 0)}
          </span>
        </div>
        {cliente.estado ? (
          <Badge status={cliente.estado}>{ESTADO_CLIENTE_LABEL_SHORT[cliente.estado]}</Badge>
        ) : null}
        {/* Afordancia de navegación: si la fila se abre, lleva chevron. */}
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground lg:hidden" />
      </button>
    </div>
  );
}

function ClientPreview({ cliente }: { cliente: ClienteDetail }) {
  const credito = cliente.creditosActivos[0] ?? null;
  const ultimosPagos = (cliente.historialPagos ?? []).slice(0, 3);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-semibold">
          {getInitials(cliente.nombre)}
        </span>
        <div className="flex flex-col">
          <span className="text-h3 font-semibold">{cliente.nombre}</span>
          <span className="text-body-sm text-muted-foreground">
            {cliente.documento} · {cliente.ruta?.nombre ?? "Sin ruta"}
          </span>
        </div>
      </div>

      {credito ? (
        <div className="flex items-center gap-5 rounded-lg border border-border bg-background p-5">
          <ProgressRing value={credito.porcentajePagado} size="md" />
          <div className="flex flex-1 flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Producto</span>
              <span className="font-medium">{credito.producto}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo pendiente</span>
              <span className="font-semibold tabular-nums">{formatCurrency(credito.saldoPendiente)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cuotas</span>
              <span className="tabular-nums">
                {credito.cuotasPagadas} / {credito.cuotasTotal} pagadas
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <p className="mb-1 text-caption text-muted-foreground uppercase">Últimos pagos</p>
        {ultimosPagos.map((pago) => (
          <div
            key={`${pago.creditoId}-${pago.fecha}-${pago.monto}`}
            className="flex items-center justify-between border-b border-border/60 py-2 last:border-0"
          >
            <span className="text-sm text-muted-foreground">{fmtFecha(pago.fecha)}</span>
            <span className="text-sm font-medium tabular-nums">{formatCurrency(pago.monto)}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto flex gap-3">
        <Button asChild className="flex-1">
          <Link href={`/admin/clients/${cliente.id}`}>Ver detalle completo</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/admin/clients/${cliente.id}/edit`}>Editar</Link>
        </Button>
      </div>
    </div>
  );
}

export function ClientsListScreen() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [routeId, setRouteId] = useState("all");
  const [estado, setEstado] = useState<EstadoFiltro>("all");
  // Eje aparte de `estado` (que es el estado de PAGO — al día/mora/etc.):
  // `vista` es si la relación con este admin está activa o dada de baja.
  // Confusión a propósito evitada con nombres distintos: un cliente inactivo
  // igual "tiene" un estado de pago, solo que ya no importa mientras no se
  // reactive.
  const [vista, setVista] = useState<"activos" | "inactivos">("activos");
  const [reactivating, setReactivating] = useState<{ id: string; nombre: string } | null>(null);
  const { data: rutas = [] } = useRutas();
  const { data: summary } = useClientesSummary();
  const { data: clientes, isLoading } = useClientes({
    ...(search ? { search } : {}),
    ...(vista === "activos" && routeId !== "all" && routeId !== "sin-ruta"
      ? { rutaId: routeId }
      : {}),
    ...(vista === "inactivos" ? { estado: "inactivos" as const } : {}),
  });

  // `search` y `rutaId` los filtra el backend; `sin-ruta` y `estado` no están
  // en `clientesQuerySchema`, así que se filtran acá sobre la respuesta.
  const porRuta = useMemo(
    () => (routeId === "sin-ruta" ? (clientes ?? []).filter((c) => !c.rutaId) : (clientes ?? [])),
    [clientes, routeId],
  );

  const clientesFiltrados = useMemo(
    () =>
      vista === "inactivos" || estado === "all"
        ? porRuta
        : porRuta.filter((c) => c.estado === estado),
    [porRuta, estado, vista],
  );

  // Los contadores se calculan ANTES del filtro de estado (pero después del de
  // ruta): si salieran de la lista ya filtrada, al elegir "Mora" todos los
  // demás chips marcarían 0.
  const estadoOptions = useMemo(
    () => [
      { value: "all" as const, label: "Todos", count: porRuta.length },
      ...ESTADO_CLIENTE_ORDER.map((value) => ({
        value,
        label: ESTADO_CLIENTE_FILTER_LABEL[value],
        count: porRuta.filter((c) => c.estado === value).length,
      })),
    ],
    [porRuta],
  );

  // Sin esto, con `vista === "inactivos"` este id apunta a un cliente inactivo
  // y `useCliente` (que exige `activo:true`) le pega un 404 innecesario en
  // segundo plano — el panel de preview no aplica a esa vista de todos modos.
  const activeId = vista === "activos" ? (selectedId ?? clientesFiltrados[0]?.id ?? "") : "";
  const { data: cliente } = useCliente(activeId);

  const subtitle = summary
    ? `${summary.clientes} ${summary.clientes === 1 ? "cliente" : "clientes"} · ${rutas.length} ${rutas.length === 1 ? "ruta" : "rutas"}`
    : undefined;

  return (
    <>
      <AdminPageHeader
        title="Clientes"
        subtitle={subtitle}
        actions={
          // En móvil el alta vive en el FAB, para no apretar el header.
          <Button asChild className="hidden lg:inline-flex">
            <Link href="/admin/clients/new">Nuevo cliente</Link>
          </Button>
        }
      />

      {/* ADMIN-only por naturaleza de la pantalla (`/admin/clients`), así que
          no hace falta un chequeo de rol acá: un cliente dado de baja solo
          tiene sentido navegarlo desde donde se administra la cartera. */}
      <div className="px-4 pt-4 sm:px-6 sm:pt-6">
        <TabsRoot value={vista} onValueChange={(value) => setVista(value as typeof vista)}>
          <TabsList>
            <TabsTrigger value="activos">Activos</TabsTrigger>
            <TabsTrigger value="inactivos">Inactivos</TabsTrigger>
          </TabsList>
        </TabsRoot>
      </div>

      {/* `min-w-0` en el grid y en sus columnas: por defecto una pista de grid
          mide `min-content`, así que un hijo con scroll propio (los chips) la
          estiraría más allá del viewport en vez de scrollear dentro. */}
      <div className="grid grid-cols-1 min-w-0 flex-1 gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
        {/* Maestro: buscador + lista */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="relative flex items-center">
            <SearchIcon className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
           </div>

           {vista === "activos" ? (
             <>
               <div className="flex flex-col gap-3 lg:flex-row">
                 <Select value={routeId} onValueChange={setRouteId}>
                   <SelectTrigger className="w-full lg:flex-1">
                     <SelectValue placeholder="Todas las rutas" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">Todas las rutas</SelectItem>
                     <SelectItem value="sin-ruta">Sin ruta</SelectItem>
                     {rutas.map((route) => (
                       <SelectItem key={route.id} value={route.id}>
                         {route.nombre}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>

                 {/* El mismo filtro de estado en dos formas: chips en móvil
                     (§2.5) y select en escritorio, donde conviven en una fila. */}
                 <Select
                   value={estado}
                   onValueChange={(value) => setEstado(value as EstadoFiltro)}
                 >
                   <SelectTrigger className="hidden w-full lg:flex lg:flex-1">
                     <SelectValue placeholder="Todos los estados" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">Todos los estados</SelectItem>
                     {ESTADO_CLIENTE_ORDER.map((value) => (
                       <SelectItem key={value} value={value}>
                         {ESTADO_CLIENTE_FILTER_LABEL[value]}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>

               <FilterChips
                 label="Filtrar por estado"
                 value={estado}
                 onValueChange={setEstado}
                 options={estadoOptions}
                 className="lg:hidden"
               />
             </>
           ) : null}

           <div className="overflow-hidden rounded-lg border border-border bg-card">
             {isLoading ? (

              <div className="flex flex-col gap-3 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : vista === "inactivos" ? (
              (clientes ?? []).length > 0 ? (
                <div className="flex flex-col divide-y divide-border">
                  {(clientes ?? []).map((c) => (
                    <InactiveClientRow
                      key={c.id}
                      cliente={c}
                      onReactivate={() => setReactivating({ id: c.id, nombre: c.nombre })}
                    />
                  ))}
                </div>
              ) : (
                <p className="p-8 text-center text-body-sm text-muted-foreground">
                  {search ? `Sin resultados para “${search}”.` : "No hay clientes inactivos."}
                </p>
              )
            ) : clientesFiltrados && clientesFiltrados.length > 0 ? (
              <div className="flex flex-col divide-y divide-border">
                {clientesFiltrados.map((c) => (
                  <ClientRow
                    key={c.id}
                    cliente={c}
                    selected={c.id === activeId}
                    onSelect={() => setSelectedId(c.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="p-8 text-center text-body-sm text-muted-foreground">
                {search ? `Sin resultados para “${search}”.` : "Ningún cliente con estos filtros."}
              </p>
            )}
          </div>
        </div>

        {/* Detalle: vista previa del cliente seleccionado. Solo en escritorio:
            en móvil la fila navega al detalle completo y este panel quedaría
            apilado debajo de toda la lista, fuera de la vista. */}
        <div className="hidden min-w-0 flex-col rounded-lg border border-border bg-card p-6 lg:flex">
          {vista === "inactivos" ? (
            <p className="m-auto text-body-sm text-muted-foreground">
              Elige &ldquo;Reactivar&rdquo; en un cliente para revisar sus créditos antes de confirmar.
            </p>
          ) : cliente ? (
            <ClientPreview cliente={cliente} />
          ) : (
            <p className="m-auto text-body-sm text-muted-foreground">
              Selecciona un cliente para ver su información.
            </p>
          )}
        </div>
      </div>

      {/* FAB de alta en móvil, por encima de la bottom tab bar (h-16). */}
      <Button
        asChild
        size="lg"
        className="fixed right-4 z-30 rounded-full shadow-lg lg:hidden"
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        <Link href="/admin/clients/new">
          <PlusIcon />
          Nuevo cliente
        </Link>
      </Button>

      <ReactivateClientDialog
        cliente={reactivating}
        onOpenChange={(open) => !open && setReactivating(null)}
      />
    </>
  );
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
