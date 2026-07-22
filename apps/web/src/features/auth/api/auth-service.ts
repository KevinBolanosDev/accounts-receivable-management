import { loginResponseSchema, usuarioSchema, type LoginRequest, type LoginResponse } from "@repo/types";
import { apiFetch } from "@/shared/api/client";

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

// Variante real: llama al backend de Nest (módulo auth, sub-fases 1.6/1.7).
export const httpAuthService: AuthService = {
  login(credentials) {
    return apiFetch("/auth/login", loginResponseSchema, {
      method: "POST",
      body: credentials,
    });
  },
};

// Único punto de inyección (ver 1.2): cambiar esta constante es todo el
// "swap" de la sub-fase 1.8. El resto del código importa `authService`,
// nunca `mockAuthService`/`httpAuthService` directamente.
export const authService: AuthService = httpAuthService;

// Confirma contra el backend que un token guardado sigue siendo válido
// (usado por useValidateSession al cargar la app).
export function fetchCurrentUser(token: string) {
  return apiFetch("/auth/me", usuarioSchema, { token });
}
