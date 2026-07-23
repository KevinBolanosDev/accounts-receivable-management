"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createRutaRequestSchema } from "@repo/types";
import { useCobradores } from "@/features/collectors/api/use-cobradores";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";

import { formatCurrency } from "@/shared/lib/format-currency";
import { getInitials } from "@/shared/lib/initials";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/ui/command";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { ProgressBar } from "@/shared/ui/progress-bar";
import { Switch } from "@/shared/ui/switch";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

import { useCreateRuta, useRuta, useUpdateRuta } from "../api/use-rutas";

interface RouteFormValues {
  nombre: string;
  cobradorId?: string | null;
  activa?: boolean;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-caption text-muted-foreground uppercase">{children}</p>;
}

function CobradorPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: collectors = [] } = useCobradores();
  const selected = collectors.find((c) => c.id === value) ?? null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
      {selected ? (
        <>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
            {getInitials(selected.nombre)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{selected.nombre}</span>
            <span className="truncate text-caption text-muted-foreground">Tel. {selected.telefono}</span>
          </div>
        </>
      ) : (
        <span className="flex-1 text-sm text-muted-foreground">Sin cobrador asignado</span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="text-primary">
            {selected ? "Cambiar" : "Asignar"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-0">
          <Command>
            <CommandInput placeholder="Buscar cobrador..." />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                 {collectors.map((collector) => (
                   <CommandItem
                     key={collector.id}
                     value={collector.nombre}
                     onSelect={() => {
                       onChange(collector.id);
                       setOpen(false);
                     }}
                   >
                     <CheckIcon className={value === collector.id ? "opacity-100" : "opacity-0"} />
                     {collector.nombre}
                   </CommandItem>
                 ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function RouteFormScreen({ rutaId }: { rutaId?: string }) {
  const router = useRouter();
  const isEdit = !!rutaId;
  const { data: ruta } = useRuta(rutaId ?? "");
  const createRuta = useCreateRuta();
  const updateRuta = useUpdateRuta(rutaId ?? "");

  const form = useForm<RouteFormValues>({
    resolver: zodResolver(createRutaRequestSchema),
    mode: "onBlur",
    defaultValues: { nombre: "", cobradorId: null, activa: true },
  });
  const { register, handleSubmit, control, setValue, reset } = form;

  useEffect(() => {
    if (ruta) {
      reset({ nombre: ruta.nombre, cobradorId: ruta.cobradorId, activa: ruta.activa });
    }
  }, [ruta, reset]);

  const nombre = useWatch({ control, name: "nombre" });
  const cobradorId = useWatch({ control, name: "cobradorId" }) ?? null;
  const activa = useWatch({ control, name: "activa" }) ?? true;
  const { data: collectors = [] } = useCobradores();
  const cobrador = collectors.find((collector) => collector.id === cobradorId) ?? null;

  // Métricas de la vista previa: en edición, las de la ruta; en alta, ceros.
  const clientesCount = ruta?.clientesCount ?? 0;
  const cobradoHoy = ruta?.cobradoHoy ?? 0;
  const avance = ruta?.avanceDelDia ?? 0;
  const abierta = (ruta?.estadoDia ?? "cerrada") === "abierta";

  async function onSubmit(values: RouteFormValues) {
    const payload = { nombre: values.nombre, cobradorId: values.cobradorId, activa: values.activa ?? true };
    try {
      if (isEdit) {
         await updateRuta.mutateAsync(payload);
        toast.success("Ruta actualizada");
      } else {
         await createRuta.mutateAsync(payload);
        toast.success("Ruta creada");
      }
      router.push("/admin/routes-collectors");
    } catch {
      toast.error("No se pudo guardar la ruta");
    }
  }

  const saving = createRuta.isPending || updateRuta.isPending;

  return (
    <>
      <AdminPageHeader
        eyebrow={isEdit ? `Rutas / ${ruta?.nombre ?? "Ruta"} · Editar` : "Rutas / Nueva"}
        title={isEdit ? "Editar ruta" : "Nueva ruta"}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Formulario */}
          <div className="flex flex-col gap-6 rounded-lg border border-border bg-card p-6">
            <div className="flex flex-col gap-3">
              <SectionLabel>Datos de la ruta</SectionLabel>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="nombre" className="text-sm font-medium">
                  Nombre de la ruta
                </label>
                <Input id="nombre" placeholder="Ej. Ruta 3 · Centro" {...register("nombre")} />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <SectionLabel>Cobrador asignado</SectionLabel>
              <CobradorPicker value={cobradorId} onChange={(id) => setValue("cobradorId", id)} />
            </div>

            <div className="flex flex-col gap-3">
              <SectionLabel>Estado</SectionLabel>
              <div className="flex items-center gap-4 rounded-lg border border-border bg-background p-4">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">Ruta activa</span>
                  <span className="text-caption text-muted-foreground">
                    Aparece en la app del cobrador.
                  </span>
                </div>
                <Switch checked={activa} onCheckedChange={(v) => setValue("activa", v)} />
              </div>
            </div>
          </div>

          {/* Vista previa en vivo */}
          <div className="flex flex-col gap-3">
            <SectionLabel>Vista previa</SectionLabel>
            <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col">
                  <span className="font-semibold">{nombre || "Nombre de la ruta"}</span>
                  <span className="text-caption text-muted-foreground">{clientesCount} clientes</span>
                </div>
                <Badge status={abierta ? "ruta-abierta" : "ruta-cerrada"}>
                  {abierta ? "Abierta" : "Cerrada"}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
                  {cobrador ? getInitials(cobrador.nombre) : "—"}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {cobrador?.nombre ?? "Sin cobrador"}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-amount font-semibold tabular-nums">
                    {formatCurrency(cobradoHoy)}
                  </span>
                  <span className={cn("text-sm font-medium tabular-nums", avance >= 100 ? "text-success" : "text-accent")}>
                    {avance}%
                  </span>
                </div>
                <ProgressBar value={avance} />
              </div>
            </div>
            <p className="text-caption text-muted-foreground">
              Así se verá la ruta en la lista. El avance del día se calcula con los cobros
              registrados.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {isEdit ? "Guardar cambios" : "Crear ruta"}
          </Button>
        </div>
      </form>
    </>
  );
}
