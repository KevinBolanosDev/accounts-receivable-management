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
    // Fase 4 — algunos errores de Nest traen un `code` machine-readable
    // además del `message` (ej. `MUST_CHANGE_PASSWORD`, `ACCOUNT_LOCKED`).
    // Opcional: la mayoría de errores no lo traen.
    public readonly code?: string,
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

// Traduce una respuesta no-2xx a ApiError, intentando leer `message`/`code`
// del cuerpo (los errores de Nest lo traen). Compartido por apiFetch y uploadFile.
async function toApiError(res: Response, path: string): Promise<ApiError> {
  const body = await res
    .json()
    .then((json: { message?: string; code?: string }) => json)
    .catch(() => undefined);
  return new ApiError(res.status, body?.message ?? `Error ${res.status} al llamar ${path}`, body?.code);
}

// Parte común de apiFetch/apiFetchVoid: arma la URL, adjunta el Bearer si hay
// token, serializa el body como JSON y traduce cualquier no-2xx a ApiError.
// Devuelve la Response sin tocar el cuerpo — quién y cómo se lee lo decide
// cada variante.
async function performRequest(path: string, options: ApiFetchOptions): Promise<Response> {
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

  if (!res.ok) throw await toApiError(res, path);

  return res;
}

// Fetch tipado: valida la respuesta con el mismo schema que usa el resto del
// sistema. Lanza ApiError (con el status) en cualquier respuesta no-2xx.
export async function apiFetch<T>(
  path: string,
  schema: Parseable<T>,
  options: ApiFetchOptions = {},
): Promise<T> {
  const res = await performRequest(path, options);

  // Un 204 no trae cuerpo: `res.json()` reventaría con un `SyntaxError`
  // opaco DESPUÉS de que el servidor ya ejecutó la acción — el bug que hacía
  // que borrar un cliente dijera "no se pudo" con el cliente ya borrado.
  // Fallar acá, nombrando la salida, convierte ese misterio en una línea.
  if (res.status === 204) {
    throw new Error(
      `El endpoint ${path} respondió 204 sin cuerpo; usa apiFetchVoid en vez de apiFetch.`,
    );
  }

  const json: unknown = await res.json();
  return schema.parse(json);
}

// Variante para endpoints que responden 204 No Content (los DELETE del
// sistema). No lee el cuerpo, así que no hay nada que pueda fallar al
// parsearlo — el problema desaparece por construcción, no por heurística
// sobre `content-length` (que no es fiable con `Transfer-Encoding: chunked`).
export async function apiFetchVoid(path: string, options: ApiFetchOptions = {}): Promise<void> {
  await performRequest(path, options);
}

interface UploadFileOptions {
  token?: string | null;
  file: File | Blob;
  /** Nombre del campo del archivo en el FormData (el backend lo espera con FileInterceptor). */
  fieldName?: string;
  /** Campos de texto extra que viajan junto al archivo en el mismo multipart. */
  fields?: Record<string, string>;
}

// Sube un archivo como `multipart/form-data`. A diferencia de apiFetch, NO fija
// `Content-Type`: el navegador lo pone con el `boundary` correcto al pasar un
// FormData. Adjunta el Bearer, valida la respuesta con el schema y lanza
// ApiError en no-2xx. Es el camino de la foto de documento (backend-proxy).
export async function uploadFile<T>(
  path: string,
  schema: Parseable<T>,
  options: UploadFileOptions,
): Promise<T> {
  const { token, file, fieldName = "file", fields } = options;

  const form = new FormData();
  form.append(fieldName, file);
  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, value);
    }
  }

  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { ...authHeaders(token) },
    body: form,
  });

  if (!res.ok) throw await toApiError(res, path);

  const json: unknown = await res.json();
  return schema.parse(json);
}
