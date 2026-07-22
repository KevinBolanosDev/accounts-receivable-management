// Iniciales para avatares: primera + última palabra (o dos primeras letras si
// es una sola palabra).
export function getInitials(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  const last = parts[parts.length - 1];
  if (parts.length === 1 || !last) return first.slice(0, 2).toUpperCase();
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}
