import { create } from "zustand";
import type { CobroResponse } from "@repo/types";

// Store EFÍMERO (NO persistido) — guarda el último `CobroResponse` para que
// la pantalla de recibo (#18c) lo pueda leer sin re-fetch cuando el cobrador
// llega desde un cobro fresco. Razones:
// 1. La tx atómica del back (cobros.service.ts) ya devuelve el `CobroResponse`
//    completo, así que tenemos TODO lo necesario en memoria.
// 2. Evita golpear el back con `GET /payments/:pagoId/receipt` cuando ya
//    tenemos los datos — la URL sirve para compartir, no para render local.
//
// Se limpia con `clearLastCobro()` al desmontar la pantalla de recibo (en el
// 4.7), o cuando se navega a otra cosa.

interface LastCobroState {
  lastCobro: CobroResponse | null;
  setLastCobro: (c: CobroResponse) => void;
  clearLastCobro: () => void;
}

export const useLastCobroStore = create<LastCobroState>((set) => ({
  lastCobro: null,
  setLastCobro: (c) => set({ lastCobro: c }),
  clearLastCobro: () => set({ lastCobro: null }),
}));