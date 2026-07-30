import * as repoTypes from "@repo/types";
import { z } from "zod";

// Guardia contra imports circulares en `@repo/types`.
//
// Contexto: `POST /collections` devolvía 500 DESPUÉS de guardar el pago porque
// `cobroResponseSchema.shape.credito` valía `undefined`. La causa era un ciclo
// `cobro.ts ↔ credito.ts`: en CommonJS, cuando el módulo que pierde la carrera
// construye su literal `z.object({ ... })`, lee el binding del otro módulo
// todavía a medio evaluar y CAPTURA el `undefined` para siempre. Zod recién
// falla al parsear, con `TypeError: Cannot read properties of undefined
// (reading '_parse')` — invisible para `tsc --noEmit` y para el build.
//
// Este spec recorre TODOS los schemas exportados por el paquete y afirma que
// ningún nodo interno quedó `undefined`. Es la única red que atrapa un ciclo
// nuevo antes de que llegue al bolsillo del cobrador.

interface BrokenNode {
  path: string;
  reason: string;
}

// Zod v3 no expone un walker público estable, así que se navega por `_def`.
// Se toca solo lo necesario para detectar el fallo (nodos con hijos).
function collectBrokenNodes(
  schema: unknown,
  path: string,
  seen: Set<unknown>,
  out: BrokenNode[],
): void {
  if (schema === undefined || schema === null) {
    out.push({ path, reason: `es ${String(schema)}` });
    return;
  }
  if (typeof schema !== "object") return;
  // Los schemas se reusan entre módulos (`creditoListItemSchema` vive dentro de
  // varios). Sin este corte, un grafo compartido se recorre exponencialmente.
  if (seen.has(schema)) return;
  seen.add(schema);

  const def = (schema as { _def?: Record<string, unknown> })._def;
  if (!def) return;

  const shapeFn = (schema as { shape?: unknown }).shape;
  if (shapeFn && typeof shapeFn === "object") {
    for (const [key, child] of Object.entries(shapeFn as Record<string, unknown>)) {
      collectBrokenNodes(child, `${path}.${key}`, seen, out);
    }
  }

  // Envoltorios de un solo hijo + contenedores.
  const childKeys = ["type", "innerType", "schema", "element", "valueType", "keyType"] as const;
  for (const key of childKeys) {
    if (key in def) {
      collectBrokenNodes(def[key], `${path}.<${key}>`, seen, out);
    }
  }

  const options = def.options;
  if (Array.isArray(options)) {
    options.forEach((option, i) => collectBrokenNodes(option, `${path}.<option[${i}]>`, seen, out));
  }
}

describe("@repo/types — integridad del grafo de schemas", () => {
  // `Object.entries` sobre el módulo devuelve una unión de tuplas muy estrecha
  // (un miembro por export), así que se ensancha a `unknown` antes de filtrar.
  const exportedSchemas = (Object.entries(repoTypes) as [string, unknown][]).filter(
    (entry): entry is [string, z.ZodTypeAny] => entry[1] instanceof z.ZodType,
  );

  it("exporta al menos un schema (el barrel resuelve)", () => {
    expect(exportedSchemas.length).toBeGreaterThan(0);
  });

  it("ningún schema exportado tiene nodos undefined (síntoma de import circular)", () => {
    const broken: BrokenNode[] = [];
    for (const [name, schema] of exportedSchemas) {
      collectBrokenNodes(schema, name, new Set(), broken);
    }

    // Mensaje explícito: si esto falla, el culpable es un ciclo de imports
    // entre archivos de `packages/types/src`, no el schema en sí.
    expect(broken.map((b) => `${b.path} ${b.reason}`)).toEqual([]);
  });

  // Sin esto, el test de arriba podría estar pasando porque el walker no
  // encuentra nada NUNCA. Se reproduce el nodo roto exactamente como lo dejaba
  // el ciclo (un campo `undefined` dentro de un `z.object`) y se exige que el
  // walker lo reporte.
  it("el walker detecta un nodo undefined (auto-test de la guardia)", () => {
    const broken: BrokenNode[] = [];
    const conCampoRoto = z.object({
      ok: z.string(),
      roto: undefined as unknown as z.ZodTypeAny, // exactamente lo que producía el ciclo
    });

    collectBrokenNodes(conCampoRoto, "conCampoRoto", new Set(), broken);

    expect(broken).toEqual([{ path: "conCampoRoto.roto", reason: "es undefined" }]);
    // Y confirmamos que ese schema efectivamente revienta al parsear, que es
    // el 500 que veía el cobrador.
    expect(() => conCampoRoto.parse({ ok: "x", roto: "y" })).toThrow(TypeError);
  });

  // Lector tolerante: el front valida TODA respuesta con estos schemas, así que
  // un campo nuevo y requerido rompe la app entera contra un backend que todavía
  // no lo manda (front desplegado antes que el back, o `.env` apuntando a otra
  // API). Pasó de verdad con `frecuencia`: `clienteDetailSchema.parse` lanzaba
  // ZodError por cada crédito y las pantallas lo mostraban como "este cliente no
  // existe". Este test fija el contrato: un crédito sin `frecuencia` parsea y
  // queda como DIARIO, que es lo que era antes de que la columna existiera.
  it("creditoListItemSchema tolera una respuesta sin `frecuencia` (backend anterior)", () => {
    const sinFrecuencia = {
      id: "credito-1",
      codigo: "CR-2003",
      clienteId: "cliente-1",
      producto: "Nevera",
      monto: 500000,
      interes: 12,
      dias: 30,
      montoTotal: 560000,
      cuotaDiaria: 18667,
      saldoPendiente: 522667,
      totalPagado: 37333,
      porcentajePagado: 6.67,
      estado: "ACTIVO",
      fechaInicio: new Date().toISOString(),
      cuotasPagadas: 2,
      cuotasTotal: 30,
    };

    const result = repoTypes.creditoListItemSchema.safeParse(sinFrecuencia);
    expect(result.success).toBe(true);
    expect(result.data?.frecuencia).toBe("DIARIO");
  });

  it("cobroResponseSchema parsea una respuesta válida de POST /collections", () => {
    // Caso de regresión exacto del bug: este `.parse()` es el que reventaba en
    // `cobros.controller.ts` con el pago ya commiteado.
    const result = repoTypes.cobroResponseSchema.safeParse({
      pago: {
        id: "pago-1",
        creditoId: "credito-1",
        monto: 18667,
        fecha: new Date().toISOString(),
        cobradorId: "cobrador-1",
        cobradorNombre: "Cobrador Demo",
        reciboUrl: null,
      },
      credito: {
        id: "credito-1",
        codigo: "CR-2003",
        clienteId: "cliente-1",
        producto: "Nevera",
        monto: 500000,
        interes: 12,
        frecuencia: "DIARIO",
        dias: 30,
        montoTotal: 560000,
        cuotaDiaria: 18667,
        saldoPendiente: 522667,
        totalPagado: 37333,
        porcentajePagado: 6.67,
        estado: "ACTIVO",
        fechaInicio: new Date().toISOString(),
        cuotasPagadas: 2,
        cuotasTotal: 30,
      },
      recibo: { url: "http://localhost:3001/payments/pago-1/receipt", codigo: "R-PAGO1" },
    });

    expect(result.success).toBe(true);
  });
});
