import { loginResponseSchema, type LoginRequest, type LoginResponse } from "@repo/types";

export interface AuthService {
  login(credentials: LoginRequest): Promise<LoginResponse>;
}

// Usuarios de prueba para desarrollar el frontend sin backend.
// Se reemplaza por httpAuthService en la sub-fase 1.8 (cableado).
const MOCK_USERS: Record<string, { password: string; usuario: LoginResponse["usuario"] }> = {
  "1000000001": {
    password: "admin123",
    usuario: { id: "mock-admin-1", nombre: "Admin Demo", documento: "1000000001", rol: "ADMIN" },
  },
  "1000000002": {
    password: "cobrador123",
    usuario: {
      id: "mock-cobrador-1",
      nombre: "Cobrador Demo",
      documento: "1000000002",
      rol: "COBRADOR",
    },
  },
};

function simulateNetworkDelay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockAuthService: AuthService = {
  async login({ documento, password }) {
    await simulateNetworkDelay();

    const entry = MOCK_USERS[documento];
    if (!entry || entry.password !== password) {
      throw new Error("Documento o contraseña incorrectos.");
    }

    return loginResponseSchema.parse({
      token: `mock-token.${entry.usuario.id}`,
      usuario: entry.usuario,
    });
  },
};
