import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

// Puente entre los dos logins de staff. Cada superficie acepta SOLO su rol
// (`LoginForm` recibe `allowedRoles`), así que quien llega al login equivocado
// no tenía forma de cruzar sin editar la URL a mano: escribía sus credenciales,
// recibía "esta cuenta no puede ingresar acá" y quedaba ahí.
//
// Va como enlace de texto y no como botón: es navegación secundaria, y un
// segundo botón al lado de "Iniciar sesión" competiría con la acción real de la
// pantalla. `Link` (no `<a>`) para que sea una transición de cliente — es el
// punto de "rapidez" de tenerlo.
export function SurfaceSwitchLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center justify-center gap-1.5 self-center rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {label}
      <ArrowRightIcon
        className="size-3.5 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
