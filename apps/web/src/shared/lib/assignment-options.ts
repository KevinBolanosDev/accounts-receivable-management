// Pick-lists mock para la asignación ruta↔cobrador (Fase 2, bloque A). Viven en
// `shared` para que las features `rutas` y `cobradores` las consuman sin
// acoplarse entre sí. Se reemplazan por fetch real en el cableado (2.14).

export interface RutaOption {
  id: string;
  nombre: string;
}

export interface CobradorOption {
  id: string;
  nombre: string;
  telefono: string;
}

export const RUTA_OPTIONS: RutaOption[] = [
  { id: "r3", nombre: "Ruta 3 · Centro" },
  { id: "r1", nombre: "Ruta 1 · Norte" },
  { id: "r2", nombre: "Ruta 2 · Sur" },
  { id: "r5", nombre: "Ruta 5 · Oriente" },
  { id: "r4", nombre: "Ruta 4 · Occidente" },
  { id: "r6", nombre: "Ruta 6 · Kennedy" },
];

export const COBRADOR_OPTIONS: CobradorOption[] = [
  { id: "c1", nombre: "Carlos Ramírez", telefono: "301 445 6789" },
  { id: "c2", nombre: "Ana Torres", telefono: "302 118 4420" },
  { id: "c3", nombre: "Marta Díaz", telefono: "310 552 9087" },
  { id: "c4", nombre: "Luis Gómez", telefono: "300 774 1265" },
  { id: "c5", nombre: "Jorge Peña", telefono: "315 660 3311" },
  { id: "c6", nombre: "Diana Reyes", telefono: "312 903 5540" },
];
