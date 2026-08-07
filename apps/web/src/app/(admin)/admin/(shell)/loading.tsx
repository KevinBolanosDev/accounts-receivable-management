import { SkeletonMetrics, SkeletonTable } from "@/shared/ui/skeletons";

// Se muestra mientras Next resuelve el segmento en una navegación. El shell
// (sidebar, tab bar) ya está montado y NO se re-renderiza: esto ocupa solo el
// área de contenido. §2.9 — forma real del contenido, nunca un spinner suelto.
export default function AdminShellLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <SkeletonMetrics columns={4} className="hidden sm:grid" />
      <SkeletonTable rows={6} columns={4} />
    </div>
  );
}
