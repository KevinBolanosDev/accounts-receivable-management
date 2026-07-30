"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CopyIcon,
  KeyIcon,
  PencilIcon,
  PlusIcon,
  ShieldOffIcon,
  Trash2Icon,
} from "lucide-react";
import type { ClienteDetail } from "@repo/types";
import { toast } from "sonner";

import { CreditCard } from "@/entities/credit";
import { ClientContactPanel, ESTADO_CLIENTE_LABEL } from "@/entities/client";
import { ApiError } from "@/shared/api/client";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Input } from "@/shared/ui/input";
import { MetricTile, MetricTileGroup } from "@/shared/ui/metric-tile";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
} from "@/shared/ui/tabs";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";
import { PageActions } from "@/widgets/admin-shell/PageActions";

import {
  useCliente,
  useDeleteCliente,
  useDeleteClientAccess,
  useGenerateClientAccess,
} from "../api/use-clientes";
import { ClientDocumentPhotos } from "./ClientDocumentPhotos";

// DESIGN_SYSTEM.md §3.3 — enriquecimiento del detalle de cliente (#5c).
// Header con saldo **agregado** (suma de los créditos activos) y badge de
// rollup; botón "Agregar crédito" lleva a la pantalla Crear (#9c) con el
// `clienteId` preseleccionado. Cuerpo: Tabs Activo / Historial con CreditCard
// en cada (el cliente puede tener VARIOS activos a la vez).

export function ClientDetailScreen({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const { data: cliente, isLoading, isError } = useCliente(clienteId);
  const deleteCliente = useDeleteCliente();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const saldoAgregado = useMemo(
    () =>
      (cliente?.creditosActivos ?? []).reduce(
        (sum, c) => sum + (c.saldoPendiente ?? 0),
        0,
      ),
    [cliente?.creditosActivos],
  );
  const montoTotalAgregado = useMemo(
    () =>
      (cliente?.creditosActivos ?? []).reduce((sum, c) => sum + c.montoTotal, 0),
    [cliente?.creditosActivos],
  );
  const porcentajeAgregado = useMemo(() => {
    if (montoTotalAgregado <= 0) return 0;
    return Math.min(
      100,
      Math.max(
        0,
        Math.round(
          ((montoTotalAgregado - saldoAgregado) / montoTotalAgregado) * 100,
        ),
      ),
    );
  }, [montoTotalAgregado, saldoAgregado]);

  if (isLoading) {
    return (
      <>
        <AdminPageHeader eyebrow="Clientes" title="Detalle de cliente" />
        <div className="p-4 sm:p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  // "No cargó" y "no existe" son estados distintos. Antes ambos caían en el
  // Skeleton de arriba, así que un cliente borrado (404) dejaba la pantalla
  // cargando para siempre, sin decir nada ni ofrecer salida.
  if (isError || !cliente) {
    return (
      <>
        <AdminPageHeader eyebrow="Clientes" title="Detalle de cliente" />
        <div className="flex flex-col items-center gap-4 p-4 sm:p-6">
          <EmptyState
            title="Este cliente no existe o fue eliminado"
            description="Puede que lo hayas eliminado desde otra pestaña, o que ya no pertenezca a tu cartera."
          />
          <Button asChild variant="secondary">
            <Link href="/admin/clients">Volver a Clientes</Link>
          </Button>
        </div>
      </>
    );
  }

  async function handleDelete() {
    try {
      await deleteCliente.mutateAsync(clienteId);
      toast.success("Cliente eliminado");
      router.push("/admin/clients");
    } catch (error) {
      // El backend manda mensajes de negocio útiles (por ejemplo el 409 de una
      // ruta con clientes); tragárselos con un texto genérico deja al usuario
      // sin saber qué hacer.
      toast.error(error instanceof ApiError ? error.message : "No se pudo eliminar el cliente");
    }
  }

  return (
    <>
      <AdminPageHeader
        eyebrow={`Clientes / ${cliente.nombre}`}
        title="Detalle de cliente"
        actions={
          <PageActions
            actions={[
              {
                id: "add-credit",
                label: "Agregar crédito test",
                icon: <PlusIcon />,
                href: `/admin/credits/new?clienteId=${cliente.id}`,
              },
              {
                id: "edit",
                label: "Editar",
                icon: <PencilIcon />,
                href: `/admin/clients/${cliente.id}/edit`,
              },
              {
                id: "delete",
                label: "Eliminar",
                icon: <Trash2Icon />,
                variant: "destructive",
                onSelect: () => setConfirmOpen(true),
              },
            ]}
          />
        }
      />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {/* Identidad + saldo agregado + badge de rollup */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            {/* El anillo sustituye al avatar de iniciales: el avance del
                cliente es el dato que se busca al abrir esta pantalla, y las
                iniciales ya no informan de nada estando el nombre al lado. */}
            <ProgressRing value={porcentajeAgregado} size="md" />
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-h2 font-semibold">{cliente.nombre}</span>
                {cliente.estado ? (
                  <Badge status={cliente.estado}>
                    {ESTADO_CLIENTE_LABEL[cliente.estado]}
                  </Badge>
                ) : null}
              </div>
              {/* Envuelve en vez de truncar: en móvil esta línea es el único
                  sitio donde se ven la ruta y el cobrador del cliente. */}
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-body-sm text-muted-foreground">
                <span>{cliente.ruta?.nombre ?? "Sin ruta"}</span>
                <span aria-hidden>·</span>
                <span>Cobrador {cliente.cobradorNombre ?? "Sin asignar"}</span>
                <span aria-hidden>·</span>
                <span>Doc {cliente.documento}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Tira de métricas (saldo agregado). Antes eran 3 cards separadas, cada
            una con su propio borde/padding/`text-h1` — el mismo dato que acá
            cabe en una tira de una línea en el resto del Admin
            (`AdminClientCreditsScreen`, `AdminCreditCollectScreen`). */}
        <MetricTileGroup columns={3} divided>
          <MetricTile
            label="Saldo pendiente"
            value={formatCurrency(saldoAgregado)}
            sub={
              cliente.creditosActivos.length > 0
                ? `de ${formatCurrency(montoTotalAgregado)}`
                : "Sin créditos activos"
            }
          />
          <MetricTile
            label="Créditos activos"
            value={String(cliente.creditosActivos.length)}
            sub={cliente.creditosActivos.length > 1 ? "varios productos" : "un producto"}
          />
          <MetricTile
            label="Créditos en historial"
            value={String(cliente.creditosHistorial.length)}
            sub="pagados / anulados"
          />
        </MetricTileGroup>

        {/* Los datos de contacto solo se veían en la app del cobrador; el
            Admin únicamente tenía el documento embutido en el encabezado. */}
        <ClientContactPanel cliente={cliente} />

        {/* La foto se subía desde Fase 2 pero nunca se mostraba en ningún
            lado — DoD pendiente hasta ahora. */}
        <ClientDocumentPhotos cliente={cliente} />

        {/* Fase 4.14 — acceso del cliente al Portal Cliente */}
        <ClientAccessSection cliente={cliente} />

        {/* Tabs Activo / Historial (Fase 3 — 1:N con varios activos) */}
        <TabsRoot defaultValue="activos">
          <TabsList>
            <TabsTrigger value="activos">
              Activo ({cliente.creditosActivos.length})
            </TabsTrigger>
            <TabsTrigger value="historial">
              Historial ({cliente.creditosHistorial.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activos">
            {cliente.creditosActivos.length === 0 ? (
              <EmptyState
                title="Este cliente no tiene créditos activos."
                description="Puedes crear uno desde el botón “Agregar crédito”."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {cliente.creditosActivos.map((credito) => (
                  <Link
                    key={credito.id}
                    href={`/admin/credits/${credito.id}`}
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
                  >
                    <CreditCard credito={credito} clienteNombre={cliente.nombre} density="compact" />
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="historial">
            {cliente.creditosHistorial.length === 0 ? (
              <EmptyState
                title="Aún no hay créditos saldados."
                description="Aquí aparecerán los créditos PAGADOS y ANULADOS."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {cliente.creditosHistorial.map((credito) => (
                  <Link
                    key={credito.id}
                    href={`/admin/credits/${credito.id}`}
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
                  >
                    <CreditCard credito={credito} clienteNombre={cliente.nombre} density="compact" />
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
        </TabsRoot>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Eliminar cliente?"
        description={`${cliente.nombre} saldrá de tu cartera y dejará de aparecer en su ruta. Sus créditos y pagos se conservan.`}
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteCliente.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}

// Fase 4.14 — sección "Acceso del cliente al portal". `tieneAccesoPortal`/
// `mustChangePassword`/`lastLoginAt` vienen de `ClienteDetail` (Fase 4.14 los
// agrega sin exponer `passwordHash` — ver packages/types/src/client.ts).
function ClientAccessSection({ cliente }: { cliente: ClienteDetail }) {
  const generateAccess = useGenerateClientAccess();
  const deleteAccess = useDeleteClientAccess();
  const [tempPassword, setTempPassword] = useState<{ value: string; expiresAt: string } | null>(
    null,
  );
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  async function handleGenerate() {
    try {
      const result = await generateAccess.mutateAsync(cliente.id);
      setTempPassword({ value: result.temporaryPassword, expiresAt: result.expiresAt });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo generar el acceso");
    }
  }

  async function handleDelete() {
    try {
      await deleteAccess.mutateAsync(cliente.id);
      toast.success("Acceso eliminado");
      setConfirmDeleteOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo eliminar el acceso");
    }
  }

  const estadoLabel = !cliente.tieneAccesoPortal
    ? "Sin acceso"
    : cliente.mustChangePassword
      ? "Debe cambiar la contraseña temporal"
      : cliente.lastLoginAt
        ? `Acceso activo · último ingreso: ${new Date(cliente.lastLoginAt).toLocaleDateString("es-CO")}`
        : "Acceso activo · sin ingresos todavía";

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="min-w-0">
        <p className="text-caption uppercase tracking-wider text-muted-foreground">
          Acceso del cliente al portal
        </p>
        <p className="text-body font-medium">{estadoLabel}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          loading={generateAccess.isPending}
          onClick={handleGenerate}
        >
          <KeyIcon />
          {cliente.tieneAccesoPortal ? "Resetear contraseña" : "Generar contraseña"}
        </Button>
        {cliente.tieneAccesoPortal ? (
          <Button
            variant="secondary"
            size="sm"
            className="text-destructive"
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <ShieldOffIcon />
            Eliminar acceso
          </Button>
        ) : null}
      </div>

      <Dialog open={!!tempPassword} onOpenChange={(open) => !open && setTempPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contraseña temporal generada</DialogTitle>
            <DialogDescription>
              Compártela con el cliente fuera de la app. No se vuelve a mostrar.
            </DialogDescription>
          </DialogHeader>
          {tempPassword ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Input readOnly value={tempPassword.value} className="font-mono" />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label="Copiar contraseña"
                  onClick={() => {
                    void navigator.clipboard.writeText(tempPassword.value);
                    toast.success("Copiada al portapapeles");
                  }}
                >
                  <CopyIcon />
                </Button>
              </div>
              <p className="text-body-sm text-muted-foreground">
                Válida hasta {new Date(tempPassword.expiresAt).toLocaleString("es-CO")}.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setTempPassword(null)}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="¿Eliminar acceso al portal?"
        description="El cliente ya no podrá ingresar con sus credenciales actuales. Puedes volver a generarle una contraseña cuando quieras."
        confirmLabel="Eliminar acceso"
        variant="destructive"
        loading={deleteAccess.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card p-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-caption text-muted-foreground">{description}</p>
    </div>
  );
}
