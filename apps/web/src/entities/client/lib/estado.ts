import type { EstadoCliente } from "@repo/types";

// Etiquetas y color de texto de los estados de crédito de un cliente (badges §2.3).
export const ESTADO_CLIENTE_LABEL: Record<EstadoCliente, string> = {
  activo: "Activo",
  "proximo-a-vencer": "Por vencer",
  mora: "Mora",
  pagado: "Pagado",
};

// Etiqueta compacta para listas angostas (pantalla 3c).
export const ESTADO_CLIENTE_LABEL_SHORT: Record<EstadoCliente, string> = {
  activo: "Activo",
  "proximo-a-vencer": "Próx.",
  mora: "Mora",
  pagado: "Pagado",
};

// Orden canónico de los estados cuando se listan como filtros. Es el mismo
// orden del enum en `@repo/types`: de sano a crítico y luego cerrado.
export const ESTADO_CLIENTE_ORDER: EstadoCliente[] = [
  "activo",
  "proximo-a-vencer",
  "mora",
  "pagado",
];

// Etiqueta en plural para los filtros ("Activos"), frente a la del badge, que
// califica a UN cliente y va en singular ("Activo").
export const ESTADO_CLIENTE_FILTER_LABEL: Record<EstadoCliente, string> = {
  activo: "Activos",
  "proximo-a-vencer": "Por vencer",
  mora: "Mora",
  pagado: "Pagados",
};

export const ESTADO_CLIENTE_TEXT: Record<EstadoCliente, string> = {
  activo: "text-accent",
  "proximo-a-vencer": "text-warning",
  mora: "text-destructive",
  pagado: "text-success",
};
