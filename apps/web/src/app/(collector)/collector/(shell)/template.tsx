import { PageTransition } from "@/shared/lib/motion";

// Espejo del template del Admin: la bottom tab bar del `CollectorShell` no se
// re-monta, solo entra el contenido de la pestaña.
export default function CollectorShellTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
