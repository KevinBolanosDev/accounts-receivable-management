import { apiFetch } from "@/shared/api/client";
import {
  clientAuthUserSchema,
  clientLoginResponseSchema,
  type ChangePasswordRequest,
  type ClientAuthUser,
  type ClientLoginRequest,
  type ClientLoginResponse,
} from "@repo/types";

import { useClientSessionStore } from "@/entities/session";

export interface ClientAuthService {
  login(body: ClientLoginRequest): Promise<ClientLoginResponse>;
  changePassword(
    body: ChangePasswordRequest,
    token: string,
  ): Promise<ClientAuthUser>;
  fetchMe(token: string): Promise<ClientAuthUser>;
}

// Mock para desarrollar el frontend sin backend — clientes demo del seed:
// 1000000010/cliente123 y 1000000011/cliente123 (Ruta Centro). Ambos con
// `mustChangePassword=true`, así que el modal de cambio se abre al primer
// ingreso. Cualquier otro documento → error genérico.
const MOCK_CLIENT_USERS: Record<string, { password: string; cliente: ClientAuthResponse["cliente"] }> = {
  "1000000010": {
    password: "cliente123",
    cliente: {
      id: "mock-client-1",
      nombre: "María Fernández",
      documento: "1000000010",
      telefono: "3011112222",
      direccion: "Cra 12 #34-56, Centro",
      mustChangePassword: true,
    },
  },
  "1000000011": {
    password: "cliente123",
    cliente: {
      id: "mock-client-2",
      nombre: "Carlos Ramírez",
      documento: "1000000011",
      telefono: "3012223333",
      direccion: "Cll 45 #10-20, Centro",
      mustChangePassword: true,
    },
  },
};

type ClientAuthResponse = ClientLoginResponse;

function simulateNetworkDelay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockClientAuthService: ClientAuthService = {
  async login({ documento, password }) {
    await simulateNetworkDelay();
    const entry = MOCK_CLIENT_USERS[documento];
    if (!entry || entry.password !== password) {
      throw new Error("Documento o contraseña incorrectos.");
    }
    return clientLoginResponseSchema.parse({
      token: `mock-client-token.${entry.cliente.id}`,
      cliente: entry.cliente,
    });
  },
  async changePassword({ currentPassword, newPassword }) {
    await simulateNetworkDelay();
    if (currentPassword === newPassword) {
      throw new Error("La nueva contraseña no puede ser igual a la actual.");
    }
    const stored = useClientSessionStore.getState().cliente;
    if (!stored) throw new Error("Sesión expirada.");
    const updated = clientAuthUserSchema.parse({
      ...stored,
      mustChangePassword: false,
    });
    return updated;
  },
  async fetchMe() {
    await simulateNetworkDelay();
    const stored = useClientSessionStore.getState().cliente;
    if (!stored) throw new Error("Sin sesión.");
    return stored;
  },
};

// Variante real: llama al backend Nest (módulo `auth-cliente`, Fase 4.2).
// El login es público (`@Public()`); change-password y fetchMe viajan con
// el JWT del cliente (`@Roles("CLIENTE")`).
export const httpClientAuthService: ClientAuthService = {
  login(body) {
    return apiFetch("/client-auth/login", clientLoginResponseSchema, {
      method: "POST",
      body,
    });
  },
  changePassword(body, token) {
    return apiFetch("/client-auth/change-password", clientAuthUserSchema, {
      method: "POST",
      body,
      token,
    });
  },
  fetchMe(token) {
    return apiFetch("/client-auth/me", clientAuthUserSchema, { token });
  },
};

// Único punto de inyección (ver FASE_4_SUBFASES.md §4.4): cambiar esta
// constante es todo el "swap" entre mock y HTTP.
export const clientAuthService: ClientAuthService = httpClientAuthService;