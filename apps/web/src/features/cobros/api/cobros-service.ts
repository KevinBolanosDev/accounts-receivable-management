import { useSessionStore } from "@/entities/session";
import { apiFetch } from "@/shared/api/client";
import { cobroResponseSchema, type CobroResponse, type CreateCobroRequest } from "@repo/types";

// El flujo de lectura del cobrador ("Mis rutas" + detalle de ruta + detalle de
// cliente) NO tiene un mock propio: reusa los servicios YA reales de
// `features/routes-collectors` (`useRutas`/`useRuta`) y `features/clients`
// (`useCliente`), ambos scoped por cobrador en el backend. Lo único propio de
// "cobros" es el registro del pago (`POST /collections`, atómico, Fase 3.9).

export interface CobrosService {
  registrarCobro(body: CreateCobroRequest): Promise<CobroResponse>;
}

const delay = (ms = 450) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockCobrosService: CobrosService = {
  async registrarCobro({ monto }) {
    await delay();
    // Demo del rollback optimista: un monto "999999" simula un fallo del
    // server para poder ver la reversión del saldo + el toast de error.
    if (monto === 999_999) {
      throw new Error("Simulated server failure");
    }
    throw new Error("mockCobrosService no implementa un backend fake — usa httpCobrosService.");
  },
};

export const httpCobrosService: CobrosService = {
  registrarCobro(body) {
    return apiFetch("/collections", cobroResponseSchema, {
      method: "POST",
      body,
      token: useSessionStore.getState().token,
    });
  },
};

// El registro de cobro ya tiene backend real (Fase 3.9, transacción atómica en
// `apps/api/src/modules/cobros`) — corre contra HTTP desde que se construyó.
export const cobrosService: CobrosService = httpCobrosService;
