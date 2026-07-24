import { ChangePasswordScreen } from "@/features/client-auth";

// Pantalla de cambio obligatorio / voluntario de contraseña del cliente.
// El `ClientGuard` se encarga de redirigir aquí cuando `mustChangePassword=true`;
// una vez cambiada, `useClientChangePassword` actualiza el store y el guard
// lo manda a `/client/credit`.
export default function ChangePasswordPage() {
  return <ChangePasswordScreen />;
}