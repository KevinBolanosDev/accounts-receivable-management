"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCobradorRequestSchema, type CobradorListItem, type CreateCobradorRequest } from "@repo/types";
import { toast } from "sonner";

import { RUTA_OPTIONS } from "@/shared/lib/assignment-options";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";

import { useCreateCobrador, useUpdateCobrador } from "../api/use-cobradores";

interface CollectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si viene, el modal edita ese cobrador; si no, crea uno nuevo. */
  cobrador?: CobradorListItem;
}

export function CollectorDialog({ open, onOpenChange, cobrador }: CollectorDialogProps) {
  const isEdit = !!cobrador;
  const createCobrador = useCreateCobrador();
  const updateCobrador = useUpdateCobrador();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateCobradorRequest>({
    resolver: zodResolver(createCobradorRequestSchema),
    defaultValues: { nombre: "", telefono: "", rutaId: null, activo: true },
  });

  useEffect(() => {
    if (open) {
      reset(
        cobrador
          ? {
              nombre: cobrador.nombre,
              telefono: cobrador.telefono,
              rutaId: cobrador.rutas[0]?.id ?? null,
              activo: cobrador.activo,
            }
          : { nombre: "", telefono: "", rutaId: null, activo: true },
      );
    }
  }, [open, cobrador, reset]);

  async function onSubmit(values: CreateCobradorRequest) {
    try {
      if (isEdit && cobrador) {
        await updateCobrador.mutateAsync({ id: cobrador.id, body: values });
        toast.success("Cobrador actualizado");
      } else {
        await createCobrador.mutateAsync(values);
        toast.success("Cobrador creado");
      }
      onOpenChange(false);
    } catch {
      toast.error("No se pudo guardar el cobrador");
    }
  }

  const saving = createCobrador.isPending || updateCobrador.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cobrador" : "Nuevo cobrador"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cobrador-nombre">Nombre completo</Label>
            <Input id="cobrador-nombre" placeholder="Ej. Diana Reyes" {...register("nombre")} />
            {errors.nombre ? (
              <p className="text-body-sm text-destructive" role="alert">
                {errors.nombre.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cobrador-telefono">Teléfono</Label>
            <Input id="cobrador-telefono" placeholder="+57 300 000 0000" {...register("telefono")} />
            {errors.telefono ? (
              <p className="text-body-sm text-destructive" role="alert">
                {errors.telefono.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cobrador-ruta">Ruta asignada</Label>
            <Controller
              control={control}
              name="rutaId"
              render={({ field }) => (
                <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                  <SelectTrigger id="cobrador-ruta" className="w-full">
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
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="cobrador-activo">Activo</Label>
            <Controller
              control={control}
              name="activo"
              render={({ field }) => (
                <Switch
                  id="cobrador-activo"
                  checked={field.value ?? true}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {isEdit ? "Guardar cambios" : "Crear cobrador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
