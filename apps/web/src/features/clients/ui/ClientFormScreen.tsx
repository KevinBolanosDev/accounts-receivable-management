"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClienteRequestSchema, type CreateClienteRequest } from "@repo/types";
import { toast } from "sonner";

import { getInitials } from "@/shared/lib/initials";
import { RUTA_OPTIONS } from "@/shared/lib/assignment-options";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

import { useCliente, useCreateCliente, useUpdateCliente } from "../api/use-clientes";
import { DocumentUploader } from "./DocumentUploader";

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

function PreviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium tabular-nums">{children}</span>
    </div>
  );
}

export function ClientFormScreen({ clienteId }: { clienteId?: string }) {
  const router = useRouter();
  const isEdit = !!clienteId;
  const { data: cliente } = useCliente(clienteId ?? "");
  const createCliente = useCreateCliente();
  const updateCliente = useUpdateCliente(clienteId ?? "");

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateClienteRequest>({
    resolver: zodResolver(createClienteRequestSchema),
    defaultValues: {
      nombre: "",
      telefono: "",
      documento: "",
      direccion: "",
      rutaId: "",
      fotoDocumentoFrenteUrl: null,
      fotoDocumentoReversoUrl: null,
    },
  });

  useEffect(() => {
    if (cliente) {
      reset({
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        documento: cliente.documento,
        direccion: cliente.direccion,
        rutaId: cliente.rutaId,
        fotoDocumentoFrenteUrl: cliente.fotoDocumentoFrenteUrl,
        fotoDocumentoReversoUrl: cliente.fotoDocumentoReversoUrl,
      });
    }
  }, [cliente, reset]);

  const values = useWatch({ control });
  const rutaNombre = RUTA_OPTIONS.find((r) => r.id === values.rutaId)?.nombre ?? "Sin ruta";

  async function onSubmit(v: CreateClienteRequest) {
    try {
      if (isEdit) {
        await updateCliente.mutateAsync(v);
        toast.success("Cliente actualizado");
        router.push(`/admin/clients/${clienteId}`);
      } else {
        await createCliente.mutateAsync(v);
        toast.success("Cliente creado");
        router.push("/admin/clients");
      }
    } catch {
      toast.error("No se pudo guardar el cliente");
    }
  }

  const saving = createCliente.isPending || updateCliente.isPending;

  return (
    <>
      <AdminPageHeader
        eyebrow={isEdit ? `Clientes / ${cliente?.nombre ?? "Cliente"} · Editar` : "Clientes / Nuevo"}
        title={isEdit ? "Editar cliente" : "Nuevo cliente"}
      />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px]"
      >
        {/* Columna izquierda: formulario + acciones */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
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
              <Input id="direccion" placeholder="Cra 12 #34-56, Centro" {...register("direccion")} />
            </Field>

            <Field id="ruta" label="Ruta asignada" error={errors.rutaId?.message}>
              <Controller
                control={control}
                name="rutaId"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger id="ruta" className="w-full">
                      <SelectValue placeholder="Selecciona una ruta" />
                    </SelectTrigger>
                    <SelectContent>
                      {RUTA_OPTIONS.map((ruta) => (
                        <SelectItem key={ruta.id} value={ruta.id}>
                          {ruta.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <div className="flex flex-col gap-2">
              <Label>Foto del documento</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <DocumentUploader
                  placeholder="Frente"
                  value={values.fotoDocumentoFrenteUrl ?? null}
                  onChange={(url) => setValue("fotoDocumentoFrenteUrl", url)}
                />
                <DocumentUploader
                  placeholder="Reverso"
                  value={values.fotoDocumentoReversoUrl ?? null}
                  onChange={(url) => setValue("fotoDocumentoReversoUrl", url)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {isEdit ? "Guardar cambios" : "Guardar cliente"}
            </Button>
          </div>
        </div>

        {/* Columna derecha: vista previa en vivo */}
        <div className="flex flex-col gap-3">
          <p className="text-caption text-muted-foreground uppercase">Vista previa</p>

          <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
              {getInitials(values.nombre || "?")}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">{values.nombre || "Nombre del cliente"}</span>
              <span className="truncate text-caption text-muted-foreground">{rutaNombre}</span>
            </div>
            <ProgressRing value={0} size="md" showLabel={false} />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
            <PreviewRow label="Estado">
              <Badge status="ruta-cerrada">Sin crédito aún</Badge>
            </PreviewRow>
            <PreviewRow label="Documento">{values.documento || "—"}</PreviewRow>
            <PreviewRow label="Teléfono">{values.telefono || "—"}</PreviewRow>
          </div>

          <p className="text-caption text-muted-foreground">
            Después de guardar podrás registrar el primer crédito de este cliente.
          </p>
        </div>
      </form>
    </>
  );
}
