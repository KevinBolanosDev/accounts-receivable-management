import { COUNTRIES, DEFAULT_COUNTRY, findCountryByDial, type Country } from "./countries";

// Un teléfono se guarda en UN solo campo, en formato E.164 compacto:
// `+573001234567`. No hay columna aparte para el indicativo — el `+` ya lo
// delimita, y partirlo en dos campos obligaría a migrar la BD, el contrato de
// `@repo/types` y los cuatro sitios del backend que lo leen para ganar nada:
// nadie consulta por indicativo.
//
// Los números guardados ANTES del selector no tienen `+` (`"3001234567"`).
// Se leen como nacionales de `DEFAULT_COUNTRY` y se muestran bien; solo se
// reescriben a E.164 cuando alguien guarda ese formulario. Es una migración
// perezosa a propósito: un UPDATE masivo asumiría que todo número viejo es
// colombiano, y eso solo lo sabe quien lo cargó.

export interface ParsedPhone {
  /** Indicativo sin `+` (ej. `"57"`). */
  dial: string;
  /** Resto del número, solo dígitos. */
  national: string;
  /** `true` si el valor original traía indicativo explícito. */
  hasDialCode: boolean;
}

const digitsOnly = (value: string) => value.replace(/\D/g, "");

// Indicativos de más dígitos primero: `+1809` (Rep. Dominicana) tiene que
// ganarle a `+1` (EE. UU.), o todo el Caribe se leería como norteamericano.
const DIALS_BY_LENGTH = [...new Set(COUNTRIES.map((c) => c.dial))].sort(
  (a, b) => b.length - a.length,
);

/** Separa un valor guardado en indicativo + número nacional. */
export function parsePhone(value: string | null | undefined): ParsedPhone {
  const raw = (value ?? "").trim();
  if (!raw) return { dial: DEFAULT_COUNTRY.dial, national: "", hasDialCode: false };

  if (!raw.startsWith("+")) {
    // Legado: número suelto, sin indicativo.
    return { dial: DEFAULT_COUNTRY.dial, national: digitsOnly(raw), hasDialCode: false };
  }

  const digits = digitsOnly(raw);
  const dial = DIALS_BY_LENGTH.find((d) => digits.startsWith(d));
  if (!dial) {
    // Indicativo que no está en la tabla: se respeta el número tal cual en vez
    // de inventarle un país.
    return { dial: "", national: digits, hasDialCode: true };
  }
  return { dial, national: digits.slice(dial.length), hasDialCode: true };
}

/** País de un valor guardado (para pintar la bandera del selector). */
export function countryOfPhone(value: string | null | undefined): Country {
  const { dial } = parsePhone(value);
  return findCountryByDial(dial) ?? DEFAULT_COUNTRY;
}

/**
 * Arma el valor a guardar. Sin número nacional devuelve `""` y no `"+57"`:
 * un indicativo suelto es un teléfono vacío que igual pasaría el `min(1)` del
 * schema y dejaría clientes "con teléfono" imposibles de llamar.
 */
export function toE164(dial: string, national: string): string {
  const nationalDigits = digitsOnly(national);
  if (!nationalDigits) return "";
  return `+${digitsOnly(dial)}${nationalDigits}`;
}

/**
 * Agrupa el número nacional: los últimos 4 dígitos como bloque y el resto de a
 * 3 desde la derecha (`3001234567` → `300 123 4567`). Agrupar de a 3 desde la
 * IZQUIERDA dejaba el último dígito colgando (`300 123 456 7`), que es
 * exactamente donde el ojo se pierde al leer un teléfono en voz alta.
 *
 * Es una regla genérica a propósito: la agrupación real cambia por país y esta
 * tabla no la conoce (ver `countries.ts`).
 */
function agruparNacional(national: string): string {
  if (national.length <= 4) return national;

  const ultimos = national.slice(-4);
  const resto = national.slice(0, -4);
  const grupos: string[] = [];
  for (let fin = resto.length; fin > 0; fin -= 3) {
    grupos.unshift(resto.slice(Math.max(0, fin - 3), fin));
  }
  return [...grupos, ultimos].join(" ");
}

/** Formato de LECTURA: `+57 300 123 4567`. */
export function formatPhone(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";

  const { dial, national } = parsePhone(raw);
  if (!national) return raw;

  const numero = agruparNacional(national);
  return dial ? `+${dial} ${numero}` : `+${numero}`;
}

/**
 * Destino de un `tel:` o de `wa.me`. Sin indicativo explícito asume
 * `DEFAULT_COUNTRY`, que es lo que ya hacía `buildWhatsAppUrl` para los
 * números legados de 10 dígitos.
 */
export function toDialableE164(value: string | null | undefined): string {
  const { dial, national, hasDialCode } = parsePhone(value);
  if (!national) return "";
  // Con indicativo explícito se respeta el número aunque el prefijo no esté en
  // la tabla: anteponerle `DEFAULT_COUNTRY` produciría un número inexistente
  // (`+999…` → `+57999…`) y la llamada fallaría sin explicación.
  if (hasDialCode) return `+${dial}${national}`;
  return `+${DEFAULT_COUNTRY.dial}${national}`;
}
