import { CollectorShell } from "@/widgets/collector-shell/CollectorShell";

// Route-group `(shell)`: envuelve las vistas con pestañas del cobrador. El
// login y el alta en campo (flujo enfocado) viven fuera, sin tab bar.
export default function CollectorShellLayout({ children }: { children: React.ReactNode }) {
  return <CollectorShell>{children}</CollectorShell>;
}
