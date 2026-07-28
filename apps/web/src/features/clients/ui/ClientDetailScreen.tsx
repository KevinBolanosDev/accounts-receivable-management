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
import { ESTADO_CLIENTE_LABEL } from "@/entities/client";
import { getInitials } from "@/shared/lib/initials";
import { formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
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
import { Input } from "@/shared/ui/input";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
} from "@/shared/ui/tabs";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

import {
  useCliente,
  useDeleteCliente,
  useDeleteClientAccess,
  useGenerateClientAccess,
} from "../api/use-clientes";

// DESIGN_SYSTEM.md §3.3 — enriquecimiento del detalle de cliente (#5c).
// Header con saldo **agregado** (suma de los créditos activos) y badge de
// rollup; botón "Agregar crédito" lleva a la pantalla Crear (#9c) con el
// `clienteId` preseleccionado. Cuerpo: Tabs Activo / Historial con CreditCard
// en cada (el cliente puede tener VARIOS activos a la vez).

function StatCard({
  label,
  value,
  sub,
  subClassName,
}: {
  label: string;
  value: string;
  sub?: string;
  subClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-5">
      <span className="text-caption text-muted-foreground uppercase">{label}</span>
      <span className="text-h1 font-semibold tabular-nums">{value}</span>
      {sub ? (
        <span className={cn("text-body-sm text-muted-foreground", subClassName)}>{sub}</span>
      ) : null}
    </div>
  );
}

export function ClientDetailScreen({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const { data: cliente, isLoading } = useCliente(clienteId);
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

  if (isLoading || !cliente) {
    return (
      <>
        <AdminPageHeader eyebrow="Clientes" title="Detalle de cliente" />
        <div className="p-4 sm:p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  async function handleDelete() {
    try {
      await deleteCliente.mutateAsync(clienteId);
      toast.success("Cliente eliminado");
      router.push("/admin/clients");
    } catch {
      toast.error("No se pudo eliminar el cliente");
    }
  }

  return (
    <>
      <AdminPageHeader
        eyebrow={`Clientes / ${cliente.nombre}`}
        title="Detalle de cliente"
        actions={
          <>
            <Button
              asChild
              variant="secondary"
              aria-label={`Agregar crédito a ${cliente.nombre}`}
            >
              <Link
                href={{
                  pathname: "/admin/credits/new",
                  query: { clienteId: cliente.id },
                }}
              >
                <PlusIcon />
                Agregar crédito
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/admin/clients/${cliente.id}/edit`}>
                <PencilIcon />
                Editar
              </Link>
            </Button>
            <Button variant="secondary" className="text-destructive" onClick={() => setConfirmOpen(true)}>
              <Trash2Icon />
              Eliminar
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {/* Identidad + saldo agregado + badge de rollup */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-semibold">
              {getInitials(cliente.nombre)}
            </span>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-h2 font-semibold">{cliente.nombre}</span>
                {cliente.estado ? (
                  <Badge status={cliente.estado}>
                    {ESTADO_CLIENTE_LABEL[cliente.estado]}
                  </Badge>
                ) : null}
              </div>
              <span className="text-body-sm text-muted-foreground">
                {cliente.ruta?.nombre ?? "Sin ruta"} · Cobrador {cliente.cobradorNombre ?? "Sin asignar"} ·
                Doc {cliente.documento}
              </span>
            </div>
          </div>
        </div>

        {/* Tira de métricas (saldo agregado) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Saldo pendiente"
            value={formatCurrency(saldoAgregado)}
            sub={
              cliente.creditosActivos.length > 0
                ? `de ${formatCurrency(montoTotalAgregado)}`
                : "Sin créditos activos"
            }
          />
          <StatCard
            label="Créditos activos"
            value={String(cliente.creditosActivos.length)}
            sub={
              cliente.creditosActivos.length > 1 ? "varios productos" : "un producto"
            }
          />
          <StatCard
            label="Créditos en historial"
            value={String(cliente.creditosHistorial.length)}
            sub="pagados / anulados"
          />
          <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-5">
            <ProgressRing value={porcentajeAgregado} size="md" />
            <div className="flex flex-col">
              <span className="text-caption text-muted-foreground uppercase">Avance</span>
              <span className="text-body-sm text-muted-foreground">
                Pagado del total agregado
              </span>
            </div>
          </div>
        </div>

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
                    <CreditCard credito={credito} clienteNombre={cliente.nombre} />
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
                    <CreditCard credito={credito} clienteNombre={cliente.nombre} />
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
        </TabsRoot>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar cliente?</DialogTitle>
            <DialogDescription>
              Se eliminará a {cliente.nombre}. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" loading={deleteCliente.isPending} onClick={handleDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    } catch {
      toast.error("No se pudo generar el acceso");
    }
  }

  async function handleDelete() {
    try {
      await deleteAccess.mutateAsync(cliente.id);
      toast.success("Acceso eliminado");
      setConfirmDeleteOpen(false);
    } catch {
      toast.error("No se pudo eliminar el acceso");
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
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-5">
      <div>
        <p className="text-caption uppercase tracking-wider text-muted-foreground">
          Acceso del cliente al portal
        </p>
        <p className="text-body font-medium">{estadoLabel}</p>
      </div>
      <div className="flex gap-2">
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

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar acceso al portal?</DialogTitle>
            <DialogDescription>
              El cliente ya no podrá ingresar con sus credenciales actuales.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              loading={deleteAccess.isPending}
              onClick={handleDelete}
            >
              Eliminar acceso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
