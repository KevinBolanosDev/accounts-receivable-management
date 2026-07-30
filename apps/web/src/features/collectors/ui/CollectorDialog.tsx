"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCobradorRequestSchema, type CobradorListItem, type CreateCobradorRequest } from "@repo/types";
import { toast } from "sonner";

import { useRutas } from "@/features/routes-collectors/api/use-rutas";
import { ApiError } from "@/shared/api/client";
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
import { PhoneInput } from "@/shared/ui/phone-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

import { useCreateCobrador, useUpdateCobrador } from "../api/use-cobradores";

interface CollectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si viene, el modal edita ese cobrador; si no, crea uno nuevo. */
  cobrador?: CobradorListItem;
}

// El formulario se monta solo cuando el modal está abierto y lleva `key` por
// cobrador, así que sus valores iniciales se calculan UNA vez. Es el mismo
// patrón de `ClientFormScreen` y reemplaza al `reset` en `useEffect`, que
// dependía del objeto `cobrador` y podía pisar lo que el usuario escribiera.
export function CollectorDialog({ open, onOpenChange, cobrador }: CollectorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{cobrador ? "Editar cobrador" : "Nuevo cobrador"}</DialogTitle>
        </DialogHeader>
        {open ? (
          <CollectorForm
            key={cobrador?.id ?? "new"}
            cobrador={cobrador}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CollectorForm({
  cobrador,
  onDone,
}: {
  cobrador?: CobradorListItem;
  onDone: () => void;
}) {
  const isEdit = !!cobrador;
  const createCobrador = useCreateCobrador();
  const updateCobrador = useUpdateCobrador();
  const { data: rutas = [] } = useRutas();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateCobradorRequest>({
    resolver: zodResolver(createCobradorRequestSchema),
    defaultValues: cobrador
      ? {
          nombre: cobrador.nombre,
          telefono: cobrador.telefono ?? "",
          documento: cobrador.documento,
          password: "",
          rutaId: cobrador.rutas[0]?.id ?? null,
        }
      : { nombre: "", telefono: "", documento: "", password: "", rutaId: null },
  });

  async function onSubmit(values: CreateCobradorRequest) {
    try {
       if (isEdit && cobrador) {
         await updateCobrador.mutateAsync({
           id: cobrador.id,
           body: { nombre: values.nombre, telefono: values.telefono, rutaId: values.rutaId },
         });

        toast.success("Cobrador actualizado");
      } else {
        await createCobrador.mutateAsync(values);
        toast.success("Cobrador creado");
      }
      onDone();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "No se pudo guardar el cobrador",
      );
    }
  }

  const saving = createCobrador.isPending || updateCobrador.isPending;

  return (
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
            <Controller
              control={control}
              name="telefono"
              render={({ field }) => (
                <PhoneInput
                  id="cobrador-telefono"
                  placeholder="Ej. 300 123 4567"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
            {errors.telefono ? (
              <p className="text-body-sm text-destructive" role="alert">
                {errors.telefono.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cobrador-documento">Documento</Label>
            <Input id="cobrador-documento" placeholder="Ej. 1000000004" {...register("documento")} />
            {errors.documento ? (
              <p className="text-body-sm text-destructive" role="alert">
                {errors.documento.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cobrador-password">Contraseña inicial</Label>
            <Input id="cobrador-password" type="password" {...register("password")} />
            {errors.password ? (
              <p className="text-body-sm text-destructive" role="alert">
                {errors.password.message}
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
                     {rutas.map((route) => (
                       <SelectItem key={route.id} value={route.id}>
                         {route.nombre}
                       </SelectItem>
                     ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving}>
          {isEdit ? "Guardar cambios" : "Crear cobrador"}
        </Button>
      </DialogFooter>
    </form>
  );
}
