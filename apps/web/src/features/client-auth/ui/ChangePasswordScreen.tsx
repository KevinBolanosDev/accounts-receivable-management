"use client";

import { useClientSessionStore } from "@/entities/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

import { ChangePasswordDialog } from "./ChangePasswordDialog";

// Pantalla `/client/change-password` — el cliente llega aquí por dos razones:
// 1. `mustChangePassword=true` (modal obligatorio, bloqueante — el guard lo
//    mantiene en esta ruta hasta que cambie).
// 2. Acceso voluntario desde el portal (futuro, Fase 5+): un link "Cambiar
//    mi contraseña" desde el perfil del portal.
//
// En ambos casos, el formulario es el mismo (`ChangePasswordDialog`). El
// componente detecta si la sesión tiene `mustChangePassword` para mostrar el
// modal en modo bloqueante; si ya cambió, simplemente muestra la card con un
// mensaje de "ya está actualizada" para que la ruta no quede vacía.
export function ChangePasswordScreen() {
  const mustChangePassword = useClientSessionStore(
    (state) => state.cliente?.mustChangePassword ?? false,
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Cambia tu contraseña</CardTitle>
          <CardDescription>
            {mustChangePassword
              ? "Esta es la primera vez que ingresas. Por seguridad, debes cambiar la contraseña temporal antes de continuar."
              : "Tu contraseña ya está actualizada. Puedes cerrar esta ventana."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* El modal está montado globalmente en el layout; aquí lo
              referenciamos para que Radix registre el portal. Como el
              `open` está controlado por el store, también funciona cuando
              llegamos por navegación directa. */}
          <ChangePasswordDialog open={true} blocking={mustChangePassword} />
        </CardContent>
      </Card>
    </main>
  );
}