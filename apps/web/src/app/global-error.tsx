"use client";

import { useEffect } from "react";

// Última red: solo se dispara si falla el propio root layout, así que React ya
// no tiene ni `<html>` ni `<body>` montados y este componente debe renderizar
// el documento completo.
//
// Por lo mismo NO puede usar los primitivos de `shared/ui`: los tokens de
// color viven en `globals.css`, que se importa desde el layout que acaba de
// romperse. Estilos en línea, sin dependencias.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global]", error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          padding: "24px",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#fafafa",
          color: "#18181b",
        }}
      >
        <h1 style={{ fontSize: "20px", fontWeight: 600 }}>La aplicación no pudo iniciar</h1>
        <p style={{ fontSize: "14px", color: "#71717a" }}>
          Recargá la página. Si el problema sigue, avisá al administrador.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "8px",
            height: "40px",
            padding: "0 20px",
            borderRadius: "12px",
            border: "none",
            background: "#4f46e5",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
