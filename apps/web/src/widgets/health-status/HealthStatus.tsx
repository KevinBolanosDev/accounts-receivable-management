"use client";

import { useEffect, useState } from "react";
import { healthStatusSchema, type HealthStatus as HealthStatusData } from "@repo/types";
import { apiUrl } from "@/shared/api/client";

type State =
  | { step: "loading" }
  | { step: "error"; message: string }
  | { step: "success"; data: HealthStatusData };

export function HealthStatus() {
  const [state, setState] = useState<State>({ step: "loading" });

  useEffect(() => {
    let isMounted = true;

    fetch(apiUrl("/health"))
      .then((res) => res.json())
      .then((json: unknown) => {
        const data = healthStatusSchema.parse(json);
        if (isMounted) setState({ step: "success", data });
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState({
            step: "error",
            message: error instanceof Error ? error.message : "Error desconocido",
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (state.step === "loading") {
    return <p className="text-muted-foreground">Consultando la API...</p>;
  }

  if (state.step === "error") {
    return <p className="text-destructive">No se pudo conectar con la API: {state.message}</p>;
  }

  return (
    <dl className="grid gap-2 text-sm">
      <div className="flex gap-2">
        <dt className="font-semibold">Estado:</dt>
        <dd>{state.data.status}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="font-semibold">Uptime:</dt>
        <dd>{state.data.uptime.toFixed(2)}s</dd>
      </div>
      <div className="flex gap-2">
        <dt className="font-semibold">Hora del servidor:</dt>
        <dd>{new Date(state.data.timestamp).toLocaleString()}</dd>
      </div>
      {state.data.database && (
        <div className="flex gap-2">
          <dt className="font-semibold">Base de datos:</dt>
          <dd className={state.data.database === "up" ? "text-success" : "text-warning"}>
            {state.data.database}
          </dd>
        </div>
      )}
    </dl>
  );
}
