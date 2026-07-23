"use client";

import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftIcon } from "lucide-react";
import { createClienteRequestSchema, type CreateClienteRequest } from "@repo/types";
import { toast } from "sonner";

import { useRutas } from "@/features/routes-collectors/api/use-rutas";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

import { useCreateCliente } from "../api/use-clientes";
import { DocumentUploader } from "./DocumentUploader";

const RUTA_CORTA = "Mi ruta";

// DESIGN_SYSTEM.md §4.4 — alta de cliente en la calle: hero de gradiente +
// tarjeta con el formulario (foto primero), cámara, y botón "Guardar" fijo al
// fondo (sobre el tab bar). El cobrador solo asigna a SU ruta.
export function FieldClientCreateScreen() {
  const router = useRouter();
  const createCliente = useCreateCliente();
  const { data: rutas = [] } = useRutas();
  const activeRoute = rutas[0];

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<CreateClienteRequest>({
    resolver: zodResolver(createClienteRequestSchema),
    defaultValues: {
      nombre: "",
      telefono: "",
      documento: "",
      direccion: "",
      rutaId: activeRoute?.id ?? "",
      fotoDocumentoFrenteUrl: null,
      fotoDocumentoReversoUrl: null,
    },
  });

  const fotos = useWatch({ control, name: ["fotoDocumentoFrenteUrl", "fotoDocumentoReversoUrl"] });

  async function onSubmit(values: CreateClienteRequest) {
    try {
      await createCliente.mutateAsync(values);
      toast.success("Cliente creado");
      router.push("/collector/clients");
    } catch {
      toast.error("No se pudo guardar el cliente");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-full flex-col">
      {/* Hero de gradiente con círculos decorativos de marca */}
      <div className="relative overflow-hidden bg-linear-to-br from-primary to-accent px-3 pt-6 pb-20 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full border border-white/20"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-12 -right-6 size-44 rounded-full border border-white/20"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-4 right-4 size-24 rounded-full border border-white/15"
        />
        <div className="relative flex items-center gap-1">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Volver"
            className="flex size-9 items-center justify-center rounded-full text-white hover:bg-white/10"
          >
            <ArrowLeftIcon className="size-5" />
          </button>
          <span className="text-lg font-semibold">Nuevo cliente</span>
          <span className="ml-auto rounded-full bg-white/20 px-3 py-1 text-caption font-medium">
             {activeRoute?.nombre?.split("·")[0]?.trim() ?? RUTA_CORTA}

          </span>
        </div>
      </div>

      <div className="mx-4 -mt-12 flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-lg z-10">
          <div className="flex flex-col gap-2 border-b border-border pb-4">
            <Label>Foto del documento</Label>
            <DocumentUploader
              capture
              placeholder="Frente"
              value={fotos[0] ?? null}
              onChange={(url) => setValue("fotoDocumentoFrenteUrl", url)}
            />
            <DocumentUploader
              capture
              placeholder="Reverso"
              value={fotos[1] ?? null}
              onChange={(url) => setValue("fotoDocumentoReversoUrl", url)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-nombre">Nombre completo</Label>
            <Input id="f-nombre" className="h-12 bg-muted" placeholder="Ej. María Fernández" {...register("nombre")} />
            {errors.nombre ? <p className="text-body-sm text-destructive" role="alert">{errors.nombre.message}</p> : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-documento">Documento</Label>
            <Input id="f-documento" className="h-12 bg-muted" placeholder="Ej. 1.020.456.789" {...register("documento")} />
            {errors.documento ? <p className="text-body-sm text-destructive" role="alert">{errors.documento.message}</p> : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-telefono">Teléfono</Label>
            <Input id="f-telefono" className="h-12 bg-muted" placeholder="Ej. 300 123 4567" {...register("telefono")} />
            {errors.telefono ? <p className="text-body-sm text-destructive" role="alert">{errors.telefono.message}</p> : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-direccion">Dirección</Label>
            <Input id="f-direccion" className="h-12 bg-muted" placeholder="Ej. Cra 12 #34-56, Centro" {...register("direccion")} />
            {errors.direccion ? <p className="text-body-sm text-destructive" role="alert">{errors.direccion.message}</p> : null}
          </div>
        </div>

        <div className="mt-auto p-4">
          <Button
            type="submit"
            size="lg"
            className="w-full bg-linear-to-r from-primary to-accent"
            loading={createCliente.isPending}
          >
            Guardar cliente
          </Button>
        </div>
    </form>
  );
}
