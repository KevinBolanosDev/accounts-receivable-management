"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { loginRequestSchema, type LoginRequest } from "@repo/types";

import { useSessionStore } from "@/entities/session";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

import { mockAuthService } from "../api/auth-service";

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
      router.push(session.usuario.rol === "ADMIN" ? "/admin" : "/collector");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "No se pudo iniciar sesión.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="telefono">Teléfono</Label>
        <Input
          id="telefono"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="3001234567"
          aria-invalid={!!errors.telefono || undefined}
          aria-describedby={errors.telefono ? "telefono-error" : undefined}
          {...register("telefono")}
        />
        {errors.telefono && (
          <p id="telefono-error" className="text-xs text-destructive">
            {errors.telefono.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password || undefined}
          aria-describedby={errors.password ? "password-error" : undefined}
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

      <Button type="submit" className="w-full" loading={isSubmitting}>
        Iniciar sesión
      </Button>
    </form>
  );
}
