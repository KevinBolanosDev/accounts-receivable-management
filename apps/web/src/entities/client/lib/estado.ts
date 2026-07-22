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

export const ESTADO_CLIENTE_TEXT: Record<EstadoCliente, string> = {
  activo: "text-accent",
  "proximo-a-vencer": "text-warning",
  mora: "text-destructive",
  pagado: "text-success",
};
