import { redirect } from "next/navigation";

// DESIGN_SYSTEM.md §3.3 — los créditos existentes se navegan por el detalle
// del cliente (#5c). La sidebar del Admin aterriza en "Crear crédito" (#9c);
// si alguien entra a /admin/credits por URL, lo enviamos allí.
export default function AdminCreditsIndex() {
  redirect("/admin/credits/new");
}
