"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { loginRequestSchema, type LoginRequest, type Rol } from "@repo/types";

import { useSessionStore } from "@/entities/session";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

import { authService } from "../api/auth-service";

// Campo relleno (bg-muted) de 44px como en el prototipo #1b/#14c. Los tokens
// resuelven a los valores dark (Admin) o light (Cobrador) según la superficie
// del layout que lo envuelve — el mismo formulario sirve a las dos pantallas.
const FIELD_CLASS = "h-11 bg-muted";

const ROL_LABEL: Record<Rol, string> = {
  ADMIN: "administrador",
  COBRADOR: "cobrador",
  CLIENTE: "cliente",
};

// A dónde mandar a alguien que se equivocó de pantalla de login.
const LOGIN_PATH_POR_ROL: Record<Rol, string> = {
  ADMIN: "/admin/login",
  COBRADOR: "/collector/login",
  CLIENTE: "/client/login",
};

interface LoginFormProps {
  /** Roles que ESTA superficie acepta. Un login válido con otro rol se rechaza. */
  allowedRoles: Rol[];
  /** A dónde ir tras un login aceptado. */
  redirectTo: string;
}

export function LoginForm({ allowedRoles, redirectTo }: LoginFormProps) {
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
      const session = await authService.login(credentials);
      const rol = session.usuario.rol;

      // Cada superficie solo acepta SUS roles. Antes este formulario redirigía
      // según el rol devuelto sin mirar desde dónde se entró: con credenciales
      // de admin en /collector/login la sesión se abría igual y rebotaba a
      // /admin. Ahora se rechaza y la sesión NO se establece — el token de la
      // respuesta se descarta sin guardarse.
      if (!allowedRoles.includes(rol)) {
        setAuthError(
          `Esta es una cuenta de ${ROL_LABEL[rol]} y no tiene acceso desde aquí. Ingresa en ${LOGIN_PATH_POR_ROL[rol]}.`,
        );
        return;
      }

      setSession(session);
      router.push(redirectTo);
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
          <p id="documento-error" className="text-xs text-destructive-strong">
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
          <p id="password-error" className="text-xs text-destructive-strong">
            {errors.password.message}
          </p>
        )}
      </div>

      {authError && (
        <p role="alert" className="text-sm text-destructive-strong">
          {authError}
        </p>
      )}

      <Button type="submit" size="lg" className="mt-1 w-full" loading={isSubmitting}>
        Iniciar sesión
      </Button>

      <button
        type="button"
        onClick={() => toast("Pronto podrás restablecer tu contraseña.")}
        className="text-center text-[13px] font-medium text-accent-strong hover:underline"
      >
        ¿Olvidaste tu contraseña?
      </button>
    </form>
  );
}
