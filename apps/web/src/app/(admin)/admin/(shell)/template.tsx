import { PageTransition } from "@/shared/lib/motion";

// `template.tsx` y no `layout.tsx`: Next re-monta el template en cada
// navegación, que es lo que permite animar la entrada de cada vista. Está
// DENTRO de `(shell)` para que el sidebar/tab bar del `AdminShell` no se
// re-monte con él.
export default function AdminShellTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
