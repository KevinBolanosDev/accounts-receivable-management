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

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Acepta cualquier schema de Zod por su forma (evita depender de `zod` como
// dependencia directa de apps/web solo por el tipo).
interface Parseable<T> {
  parse: (data: unknown) => T;
}

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  token?: string | null;
  body?: unknown;
}

// Fetch tipado: arma la URL, adjunta el Bearer si hay token, serializa el
// body como JSON y valida la respuesta con el mismo schema que usa el resto
// del sistema. Lanza ApiError (con el status) en cualquier respuesta no-2xx.
export async function apiFetch<T>(
  path: string,
  schema: Parseable<T>,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { token, headers, body, ...rest } = options;

  const res = await fetch(apiUrl(path), {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const message = await res
      .json()
      .then((json: { message?: string }) => json.message)
      .catch(() => undefined);
    throw new ApiError(res.status, message ?? `Error ${res.status} al llamar ${path}`);
  }

  const json: unknown = await res.json();
  return schema.parse(json);
}
