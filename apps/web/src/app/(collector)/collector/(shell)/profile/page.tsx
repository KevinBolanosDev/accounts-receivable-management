import { LogoutButton } from "@/features/auth";

export default function CollectorProfilePage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-h2">Perfil</h1>
      <p className="text-body-sm text-muted-foreground">
        La gestión de perfil llega en fases posteriores.
      </p>
      <LogoutButton loginPath="/collector/login" />
    </div>
  );
}
