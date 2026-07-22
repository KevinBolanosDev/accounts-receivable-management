const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

// Arma el header Authorization a partir de un token de sesión.
// Recibe el token como parámetro (no lee el store) para no romper la regla
// de FSD de que `shared` nunca importa de capas superiores como `entities`.
export function authHeaders(token?: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
