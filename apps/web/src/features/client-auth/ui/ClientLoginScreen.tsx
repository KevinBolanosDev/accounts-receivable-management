"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { clientLoginRequestSchema, type ClientLoginRequest } from "@repo/types";

import { useClientSessionStore } from "@/entities/session";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

import { useClientLogin } from "../api/use-client-auth";

// Pantalla #20c v2 — acceso al portal del cliente con credenciales
// (documento + contraseña). Es la sustituta del placeholder original
// "Tu crédito" en `/client`. El cliente NO crea cuenta: la contraseña la
// genera el staff (admin/cobrador) en `POST /clients/:id/access` y la
// comparte fuera de banda. Si la temporal aún no se cambió, el backend la
// marca `mustChangePassword=true` y `ClientGuard` lo redirige a
// `/client/change-password` (ver §4.5).
const FIELD_CLASS = "h-11 bg-muted";

export function ClientLoginScreen() {
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClientLoginRequest>({
    resolver: zodResolver(clientLoginRequestSchema),
    mode: "onBlur",
  });

  const loginMutation = useClientLogin();
  const setSession = useClientSessionStore((state) => state.setSession);

  async function onSubmit(credentials: ClientLoginRequest) {
    setAuthError(null);
    try {
      const response = await loginMutation.mutateAsync(credentials);
      setSession({ token: response.token, cliente: response.cliente });
      // Si `mustChangePassword=true`, el guard lo manda a /client/change-password.
      // Si ya cambió, va directo al portal.
      router.push(
        response.cliente.mustChangePassword
          ? "/client/change-password"
          : "/client/credit",
      );
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "No se pudo iniciar sesión.",
      );
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Portal del cliente</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ingresa con tu documento y contraseña para ver tu crédito.
        </p>
      </div>

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
      </form>
    </div>
  );
}