"use client";

import { useMemo, useState } from "react";
import {
  BriefcaseIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UserIcon,
  UsersRoundIcon,
} from "lucide-react";
import type { CobradorListItem } from "@repo/types";
import { toast } from "sonner";

import { ApiError } from "@/shared/api/client";
import { getInitials } from "@/shared/lib/initials";
import { formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Input } from "@/shared/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { MetricCard } from "@/shared/ui/metric-card";
import { Skeleton } from "@/shared/ui/skeleton";
import { Switch } from "@/shared/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { AdminPageHeader, HEADER_ACTION_CLASS } from "@/widgets/admin-shell/AdminPageHeader";

import {
  useCobradores,
  useCobradoresSummary,
  useDeleteCobrador,
  useUpdateCobrador,
} from "../api/use-cobradores";
import { CollectorDialog } from "./CollectorDialog";

function rutaLabel(cobrador: CobradorListItem): string {
  if (cobrador.rutas.length === 0) return "—";
  const [first, ...rest] = cobrador.rutas;
  return rest.length ? `${first!.nombre} +${rest.length}` : first!.nombre;
}

// Fila de la lista en móvil (#m11): identidad + teléfono · ruta + badge, con
// el mismo menú de acciones que la tabla. La tabla se mantiene desde `md`,
// donde sí caben clientes, cobrado y el Switch en columnas propias
// (DESIGN_SYSTEM.md §2.5: en móvil las tablas se vuelven listas de cards).
function CobradorCardRow({
  cobrador,
  onEdit,
  onDelete,
}: {
  cobrador: CobradorListItem;
  onEdit: (c: CobradorListItem) => void;
  onDelete: (c: CobradorListItem) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
        {getInitials(cobrador.nombre)}
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{cobrador.nombre}</span>
        <span className="truncate text-caption text-muted-foreground">
          {cobrador.telefono ?? "Sin teléfono"} · {rutaLabel(cobrador)}
        </span>
      </div>

      <Badge status={cobrador.activo ? "activo" : "ruta-cerrada"}>
        {cobrador.activo ? "Activo" : "Inactivo"}
      </Badge>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Acciones de ${cobrador.nombre}`}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onEdit(cobrador)}>
            <PencilIcon />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(cobrador)}>
            <Trash2Icon />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function CobradoRow({
  cobrador,
  onEdit,
  onDelete,
}: {
  cobrador: CobradorListItem;
  onEdit: (c: CobradorListItem) => void;
  onDelete: (c: CobradorListItem) => void;
}) {
  const updateCobrador = useUpdateCobrador();
  const sinAbrir = cobrador.cobradoHoy === 0 && cobrador.activo && cobrador.rutas.length > 0;

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
            {getInitials(cobrador.nombre)}
          </span>
          <div className="flex flex-col">
            <span className="font-medium">{cobrador.nombre}</span>
            <span className="text-caption text-muted-foreground">{cobrador.telefono}</span>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{rutaLabel(cobrador)}</TableCell>
      <TableCell className="tabular-nums">{cobrador.clientesCount || "—"}</TableCell>
      <TableCell className="tabular-nums">
        {cobrador.cobradoHoy > 0 ? (
          formatCurrency(cobrador.cobradoHoy)
        ) : (
          <span className="text-muted-foreground">{sinAbrir ? "Sin abrir" : "—"}</span>
        )}
      </TableCell>
      <TableCell>
        <Badge status={cobrador.activo ? "activo" : "ruta-cerrada"}>
          {cobrador.activo ? "Activo" : "Inactivo"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-3">
          <Tooltip>
            {/* El trigger envuelve un <span>, no el Switch directamente: Radix
                Slot (asChild) fusiona los props del trigger sobre el hijo, y
                Tooltip/Switch usan `data-state` con significados distintos
                (abierto/cerrado del popover vs. checked/unchecked) — sobre el
                Switch directo, el del Tooltip pisa al del Switch y el CSS
                `data-[state=checked]:bg-primary` nunca hace match. */}
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Switch
                  checked={cobrador.activo}
                  aria-label={cobrador.activo ? "Desactivar" : "Activar"}
                  onCheckedChange={(checked) =>
                    updateCobrador.mutate({ id: cobrador.id, body: { activo: checked } })
                  }
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>{cobrador.activo ? "Desactivar" : "Activar"}</TooltipContent>
          </Tooltip>
          {/* Menú en vez de un icono por acción: junto al Switch, tres
              controles sueltos saturan la celda y en móvil no caben. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Acciones de ${cobrador.nombre}`}>
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit(cobrador)}>
                <PencilIcon />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(cobrador)}>
                <Trash2Icon />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function CollectorsScreen() {
  const { data: cobradores, isLoading } = useCobradores();
  const { data: summary } = useCobradoresSummary();
  const deleteCobrador = useDeleteCobrador();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CobradorListItem | undefined>(undefined);
  // Un solo diálogo para toda la tabla, con el cobrador pendiente en estado:
  // uno por fila montaría N diálogos para que solo se abra uno.
  const [deleting, setDeleting] = useState<CobradorListItem | null>(null);

  // Filtro local: la lista de cobradores de un admin es corta (decenas), así
  // que no justifica un parámetro de búsqueda en el endpoint.
  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cobradores ?? [];
    return (cobradores ?? []).filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.telefono?.toLowerCase().includes(q) ?? false) ||
        c.documento.toLowerCase().includes(q),
    );
  }, [cobradores, search]);

  const conRuta = useMemo(
    () => (cobradores ?? []).filter((c) => c.rutas.length > 0).length,
    [cobradores],
  );

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(cobrador: CobradorListItem) {
    setEditing(cobrador);
    setDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await deleteCobrador.mutateAsync(deleting.id);
      toast.success(`${deleting.nombre} fue eliminado`);
      setDeleting(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo eliminar el cobrador");
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Cobradores"
        subtitle={
          summary
            ? `${summary.cobradoresTotal} cobradores · ${conRuta} con ruta`
            : undefined
        }
        actions={
          // En móvil el alta vive en el FAB, para no apretar el header.
          <Button onClick={openCreate} className={cn("hidden lg:inline-flex", HEADER_ACTION_CLASS)}>
            <PlusIcon />
            Nuevo cobrador
          </Button>
        }
      />

      <div className="flex min-w-0 flex-col gap-6 p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            tone="success"
            icon={<UsersRoundIcon />}
            label="Cobradores activos"
            value={summary?.cobradoresActivos ?? "—"}
            sub={summary ? `de ${summary.cobradoresTotal}` : undefined}
          />
          <MetricCard
            tone="primary"
            icon={<UserIcon />}
            label="Clientes cubiertos"
            value={summary?.clientesCubiertos ?? "—"}
          />
          <MetricCard
            tone="primary"
            icon={<BriefcaseIcon />}
            label="Cobrado hoy (equipo)"
            value={summary ? formatCurrency(summary.cobradoHoyEquipo) : "—"}
          />
        </div>

        <div className="relative flex items-center">
          <SearchIcon className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cobrador..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Lista en móvil */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card md:hidden">
          {isLoading ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <p className="p-8 text-center text-body-sm text-muted-foreground">
              {search ? `Sin resultados para “${search}”.` : "Aún no hay cobradores."}
            </p>
          ) : (
            filtrados.map((cobrador) => (
              <CobradorCardRow
                key={cobrador.id}
                cobrador={cobrador}
                onEdit={openEdit}
                onDelete={setDeleting}
              />
            ))
          )}
        </div>

        {/* Tabla desde md */}
        <div className="hidden rounded-lg border border-border bg-card md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cobrador</TableHead>
                <TableHead>Ruta</TableHead>
                <TableHead>Clientes</TableHead>
                <TableHead>Cobrado hoy</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : filtrados.map((cobrador) => (
                    <CobradoRow
                      key={cobrador.id}
                      cobrador={cobrador}
                      onEdit={openEdit}
                      onDelete={setDeleting}
                    />
                  ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* FAB de alta en móvil, por encima de la bottom tab bar (h-16). */}
      <Button
        size="lg"
        onClick={openCreate}
        className="fixed right-4 z-30 rounded-full shadow-lg lg:hidden"
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        <PlusIcon />
        Nuevo cobrador
      </Button>

      <CollectorDialog open={dialogOpen} onOpenChange={setDialogOpen} cobrador={editing} />

      {/* Pide el documento: reactivar al cobrador con el Switch es trivial,
          pero la reasignación de sus rutas hay que rehacerla a mano. */}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="¿Eliminar cobrador?"
        description={
          deleting
            ? `${deleting.nombre} quedará inactivo y no podrá volver a iniciar sesión. Sus rutas quedarán sin cobrador asignado y sus pagos registrados se conservan.`
            : ""
        }
        confirmLabel="Eliminar cobrador"
        variant="destructive"
        loading={deleteCobrador.isPending}
        confirmPhrase={deleting?.documento}
        confirmPhraseLabel="Escribe el documento del cobrador para confirmar"
        onConfirm={handleDelete}
      />
    </>
  );
}
