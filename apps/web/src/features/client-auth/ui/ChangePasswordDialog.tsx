"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  changePasswordRequestSchema,
  type ChangePasswordRequest,
} from "@repo/types";
import { toast } from "sonner";

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
import { Label } from "@/shared/ui/label";

import { useClientChangePassword } from "../api/use-client-auth";

interface ChangePasswordDialogProps {
  /**
   * Si `true`, el dialog se muestra no-cerrable (sin Escape, sin click fuera).
   * Lo usa el layout cuando el cliente tiene `mustChangePassword=true`: no
   * puede ignorar el cambio de la temporal. Si `false`, el dialog es
   * voluntariamente dismissable (futuro: "Cambiar mi contraseña" desde el
   * portal).
   */
  open: boolean;
  /** Si `true`, deshabilita el cierre (Escape + click fuera). */
  blocking: boolean;
}

const FIELD_CLASS = "h-11 bg-muted";

// Cambio de contraseña compartido por el modal obligatorio y la pantalla
// `/client/change-password`. Mismo formulario, distinto wrapper — el modal
// bloquea cuando viene del flag `mustChangePassword=true`; la pantalla
// permite cierre porque es voluntaria.
export function ChangePasswordDialog({ open, blocking }: ChangePasswordDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ChangePasswordRequest>({
    resolver: zodResolver(changePasswordRequestSchema),
    mode: "onBlur",
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  const changePasswordMutation = useClientChangePassword();

  async function onSubmit(values: ChangePasswordRequest) {
    setSubmitError(null);
    try {
      await changePasswordMutation.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success("Contraseña actualizada.");
      reset();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo cambiar la contraseña.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      // Bloqueamos el cierre solo cuando es obligatorio (modal forzado).
      // Cuando es voluntario, el usuario puede cerrarlo con Escape o click fuera.
      onOpenChange={(next) => {
        if (!next && blocking) return;
        // Para cambio voluntario, dejamos que Radix cierre solo.
      }}
    >
      <DialogContent
        // Solo deshabilitamos el cierre externo cuando es el modal obligatorio.
        onPointerDownOutside={blocking ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={blocking ? (e) => e.preventDefault() : undefined}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Cambia tu contraseña</DialogTitle>
          <DialogDescription>
            {blocking
              ? "Esta es la primera vez que ingresas. Por seguridad, debes cambiar la contraseña temporal antes de continuar."
              : "Ingresa tu contraseña actual y la nueva (mínimo 8 caracteres)."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentPassword" className="text-muted-foreground">
              Contraseña actual
            </Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              placeholder="Tu contraseña actual"
              aria-invalid={!!errors.currentPassword || undefined}
              className={FIELD_CLASS}
              {...register("currentPassword")}
            />
            {errors.currentPassword && (
              <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPassword" className="text-muted-foreground">
              Nueva contraseña
            </Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              aria-invalid={!!errors.newPassword || undefined}
              className={FIELD_CLASS}
              {...register("newPassword")}
            />
            {errors.newPassword && (
              <p className="text-xs text-destructive">{errors.newPassword.message}</p>
            )}
          </div>

          {submitError && (
            <p role="alert" className="text-sm text-destructive">
              {submitError}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" loading={isSubmitting} className="w-full">
              Cambiar contraseña
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}