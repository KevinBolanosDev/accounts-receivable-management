"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { loginRequestSchema, type LoginRequest } from "@repo/types";

import { useSessionStore } from "@/entities/session";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

import { mockAuthService } from "../api/auth-service";

// Campo relleno (bg-muted) de 44px como en el prototipo #1b/#14c. Los tokens
// resuelven a los valores dark (Admin) o light (Cobrador) según la superficie
// del layout que lo envuelve — el mismo formulario sirve a las dos pantallas.
const FIELD_CLASS = "h-11 bg-muted";

export function LoginForm() {
  const router = useRouter();
  const setSession = useSessionStore((state) => state.setSession);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    mode: "onBlur",
  });

  async function onSubmit(credentials: LoginRequest) {
    setAuthError(null);
    try {
      const session = await mockAuthService.login(credentials);
      setSession(session);
      // Redirección por el rol de la respuesta, no por la ruta de origen.
      router.push(session.usuario.rol === "ADMIN" ? "/admin" : "/collector");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "No se pudo iniciar sesión.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="documento" className="text-muted-foreground">
          Documento de identidad
        </Label>
        <Input
          id="documento"
          type="text"
          inputMode="numeric"
          autoComplete="username"
          placeholder="1234567890"
          aria-invalid={!!errors.documento || undefined}
          aria-describedby={errors.documento ? "documento-error" : undefined}
          className={FIELD_CLASS}
          {...register("documento")}
        />
        {errors.documento && (
          <p id="documento-error" className="text-xs text-destructive">
            {errors.documento.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password" className="text-muted-foreground">
          Contraseña
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="Tu contraseña"
          aria-invalid={!!errors.password || undefined}
          aria-describedby={errors.password ? "password-error" : undefined}
          className={FIELD_CLASS}
          {...register("password")}
        />
        {errors.password && (
          <p id="password-error" className="text-xs text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      {authError && (
        <p role="alert" className="text-sm text-destructive">
          {authError}
        </p>
      )}

      <Button type="submit" size="lg" className="mt-1 w-full" loading={isSubmitting}>
        Iniciar sesión
      </Button>

      <button
        type="button"
        onClick={() => toast("Pronto podrás restablecer tu contraseña.")}
        className="text-center text-[13px] font-medium text-accent hover:underline"
      >
        ¿Olvidaste tu contraseña?
      </button>
    </form>
  );
}
