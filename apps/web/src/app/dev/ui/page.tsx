"use client";

import { useEffect, useRef, useState } from "react";
import { notFound } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  LogOutIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ClientCard } from "@/entities/client";
import { CreditCard } from "@/entities/credit";
import type { CreditoListItem } from "@repo/types";
import { formatCurrency } from "@/shared/lib/format-currency";
import {
  animateProgressRing,
  useCountUp,
  useGSAP,
  useReducedMotion,
  useReveal,
  useStagger,
} from "@/shared/lib/motion";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { WhatsAppIcon } from "@/shared/ui/icons/whatsapp-icon";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/shared/ui/tabs";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Textarea } from "@/shared/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border flex flex-col gap-4 border-b pb-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-h2">{title}</h2>
        {description && <p className="text-body-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function AnimatedRing({ value }: { value: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useGSAP(() => animateProgressRing(ref.current, { reduced }), {
    scope: ref,
    dependencies: [value, reduced],
  });

  return <ProgressRing ref={ref} value={value} size="hero" />;
}

function StaggerDemo() {
  const ref = useStagger<HTMLUListElement>("[data-stagger-item]");
  const clientes = ["María Fernández", "Luis Pardo", "Ana Torres", "Carlos Ramírez"];

  return (
    <ul ref={ref} className="flex flex-col gap-2">
      {clientes.map((nombre) => (
        <li
          key={nombre}
          data-stagger-item
          className="border-border bg-card rounded-lg border px-4 py-3 text-sm"
        >
          {nombre}
        </li>
      ))}
    </ul>
  );
}

function CountUpDemo() {
  const ref = useCountUp(320000, { format: formatCurrency });
  return <span ref={ref} className="text-display tabular-nums" />;
}

function RevealDemo() {
  const ref = useReveal({ token: "hero" });
  return (
    <div
      ref={ref}
      className="from-primary to-accent text-primary-foreground rounded-xl bg-linear-to-br p-6"
    >
      <p className="text-h3">Entrada del hero móvil</p>
      <p className="text-body-sm opacity-80">useReveal con token “hero”.</p>
    </div>
  );
}

function FormDemo() {
  const form = useForm<{ nombre: string }>({ defaultValues: { nombre: "" }, mode: "onBlur" });

  return (
    <Form {...form}>
      <form
        className="flex max-w-sm flex-col gap-4"
        onSubmit={form.handleSubmit(() => toast.success("Formulario válido"))}
      >
        <FormField
          control={form.control}
          name="nombre"
          rules={{ required: "El nombre es obligatorio." }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del cliente</FormLabel>
              <FormControl>
                <Input placeholder="María Fernández" {...field} />
              </FormControl>
              <FormDescription>Se muestra en la ficha y en los recibos.</FormDescription>
              {/* Testing */}
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" variant="secondary" className="w-fit">
          Validar
        </Button>
      </form>
    </Form>
  );
}

const COBRADORES_DEMO = ["Carlos Ramírez", "Ana Torres", "Luis Pardo", "Diana Gómez"];

const CREDIT_DEMO_HERO: CreditoListItem = {
  id: "cr-2041",
  codigo: "CR-2041",
  clienteId: "cl1",
  producto: "Nevera Mabe 360L",
  monto: 800_000,
  interes: 25,
  dias: 50,
  montoTotal: 1_000_000,
  cuotaDiaria: 20_000,
  saldoPendiente: 320_000,
  totalPagado: 680_000,
  porcentajePagado: 68,
  estado: "ACTIVO",
  fechaInicio: "2026-06-18T00:00:00.000Z",
  cuotasPagadas: 34,
  cuotasTotal: 50,
};

const CREDIT_DEMO_PAGADO: CreditoListItem = {
  ...CREDIT_DEMO_HERO,
  id: "cr-2052",
  codigo: "CR-2052",
  clienteId: "cl4",
  saldoPendiente: 0,
  totalPagado: 1_000_000,
  porcentajePagado: 100,
  estado: "PAGADO",
  cuotasPagadas: 50,
};

const CREDIT_DEMO_MORA: CreditoListItem = {
  ...CREDIT_DEMO_HERO,
  id: "cr-2050",
  codigo: "CR-2050",
  clienteId: "cl2",
  producto: "Lavadora Samsung 19kg",
  monto: 1_000_000,
  interes: 20,
  dias: 48,
  montoTotal: 1_200_000,
  cuotaDiaria: 25_000,
  saldoPendiente: 540_000,
  totalPagado: 660_000,
  porcentajePagado: 55,
  estado: "MORA",
  cuotasTotal: 48,
};

function ComboboxDemo() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" role="combobox" aria-expanded={open} className="w-64 justify-between">
          {value ?? "Selecciona un cobrador"}
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar cobrador..." />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {COBRADORES_DEMO.map((nombre) => (
                <CommandItem
                  key={nombre}
                  value={nombre}
                  onSelect={(current) => {
                    setValue(current === value ? null : current);
                    setOpen(false);
                  }}
                >
                  <CheckIcon className={value === nombre ? "opacity-100" : "opacity-0"} />
                  {nombre}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function UserMenuDemo() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">
          <UserIcon />
          Admin Demo
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <UserIcon />
          Perfil
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive">
          <LogOutIcon />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RowActionsDemo() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Acciones">
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem>
          <PencilIcon />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive">
          <Trash2Icon />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SwitchDemo() {
  const [checked, setChecked] = useState(true);
  return (
    <div className="flex items-center gap-3">
      <Switch id="gallery-activa" checked={checked} onCheckedChange={setChecked} />
      <Label htmlFor="gallery-activa">Ruta {checked ? "activa" : "inactiva"}</Label>
    </div>
  );
}

export default function UiGalleryPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.toggle("dark", mode === "dark");
    return () => {
      root.classList.toggle("dark", hadDark);
    };
  }, [mode]);

  return (
    <div className="bg-background text-foreground mx-auto flex max-w-4xl flex-col gap-10 px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-h1">/dev/ui — Galería del design system</h1>
          <p className="text-body-sm text-muted-foreground">
            Fase 0.5 · CobroDiario. Solo disponible en desarrollo.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setMode((current) => (current === "light" ? "dark" : "light"))}
        >
          Ver en modo {mode === "light" ? "oscuro" : "claro"}
        </Button>
      </header>

      <Section title="Botones" description="Variantes × tamaños — DESIGN_SYSTEM.md §2.1">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" loading>
            Guardando
          </Button>
          <Button variant="primary" size="icon" aria-label="Agregar">
            <PlusIcon />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">sm · 32px</Button>
          <Button size="md">md · 40px</Button>
          <Button size="lg">lg · 48px</Button>
        </div>
      </Section>

      <Section title="Badges de estado" description="DESIGN_SYSTEM.md §2.3">
        <div className="flex flex-wrap gap-2">
          <Badge status="activo">Activo</Badge>
          <Badge status="proximo-a-vencer">Próximo a vencer</Badge>
          <Badge status="mora">Mora</Badge>
          <Badge status="pagado">Pagado</Badge>
          <Badge status="ruta-abierta">Ruta abierta</Badge>
          <Badge status="ruta-cerrada">Ruta cerrada</Badge>
        </div>
      </Section>

      <Section title="Formularios" description="Input, Select, Textarea — radius sm, foco con ring">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gallery-nombre">Nombre</Label>
            <Input id="gallery-nombre" placeholder="María Fernández" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gallery-ruta">Ruta</Label>
            <Select>
              <SelectTrigger id="gallery-ruta" className="w-full">
                <SelectValue placeholder="Selecciona una ruta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="centro">Ruta 3 · Centro</SelectItem>
                <SelectItem value="sur">Ruta 2 · Sur</SelectItem>
                <SelectItem value="occidente">Ruta 4 · Occidente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="gallery-notas">Notas</Label>
            <Textarea id="gallery-notas" placeholder="Observaciones del cliente..." />
          </div>
        </div>
      </Section>

      <Section
        title="Card"
        description="DESIGN_SYSTEM.md §2.4 — radius lg, borde 1px, padding 16–24px"
      >
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>María Fernández</CardTitle>
            <CardDescription>Ruta 3 · Centro</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-amount tabular-nums">{formatCurrency(320000)}</span>
            <Badge status="activo">Activo</Badge>
          </CardContent>
        </Card>
      </Section>

      <Section title="Tabla" description="Sin cebra, hover resalta la fila — DESIGN_SYSTEM.md §2.5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Ruta</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Jorge Salcedo</TableCell>
              <TableCell>Ruta 3 · Centro</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(180000)}</TableCell>
              <TableCell>
                <Badge status="proximo-a-vencer">Próximo a vencer</Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Laura Pérez</TableCell>
              <TableCell>Ruta 6 · Kennedy</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(540000)}</TableCell>
              <TableCell>
                <Badge status="mora">Mora</Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Section>

      <Section
        title="Anillo de progreso"
        description="32 / 64 / 120px, viraje a --success sobre ~90% — DESIGN_SYSTEM.md §1.7"
      >
        <div className="flex flex-wrap items-end gap-8">
          <div className="flex flex-col items-center gap-2">
            <ProgressRing value={45} size="mini" />
            <span className="text-caption text-muted-foreground uppercase">mini · 32</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ProgressRing value={68} size="md" />
            <span className="text-caption text-muted-foreground uppercase">md · 64</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ProgressRing value={95} size="md" />
            <span className="text-caption text-muted-foreground uppercase">md · 64 (≥90%)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <AnimatedRing value={68} />
            <span className="text-caption text-muted-foreground uppercase">
              hero · 120 (animado)
            </span>
          </div>
        </div>
      </Section>

      <Section
        title="Movimiento"
        description="useReveal, useStagger, useCountUp — GSAP, con gate de prefers-reduced-motion"
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <RevealDemo />
          <div className="flex flex-col gap-2">
            <span className="text-caption text-muted-foreground uppercase">
              Mi ruta de hoy (stagger)
            </span>
            <StaggerDemo />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-caption text-muted-foreground uppercase">Count-up de monto</span>
          <CountUpDemo />
        </div>
      </Section>

      <Section
        title="Form (react-hook-form)"
        description="Wrapper con Label + control + descripción + error a11y — Fase 2"
      >
        <FormDemo />
      </Section>

      <Section title="Avatar" description="Iniciales de la Client card — DESIGN_SYSTEM.md §2.4">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>MF</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>LP</AvatarFallback>
          </Avatar>
          <Avatar className="size-12">
            <AvatarFallback>AT</AvatarFallback>
          </Avatar>
        </div>
      </Section>

      <Section
        title="Client card"
        description="entities/client — saldo/estado/anillo son stub hasta la Fase 3"
      >
        <div className="grid max-w-md gap-3">
          <ClientCard
            cliente={{ nombre: "María Fernández", ruta: { id: "r1", nombre: "Ruta 3 · Centro" } }}
            interactive
          />
          <ClientCard
            cliente={{ nombre: "Luis Pardo", ruta: { id: "r2", nombre: "Ruta 6 · Kennedy" } }}
            saldoPendiente={180000}
            estado="proximo-a-vencer"
            porcentajePagado={62}
          />
        </div>
      </Section>

      <Section
        title="Credit card"
        description="entities/credit — densidades hero (10a/5c) y compacta (16c móvil)"
      >
        <div className="grid max-w-2xl gap-4">
          <CreditCard credito={CREDIT_DEMO_HERO} clienteNombre="María Fernández" />
          <CreditCard credito={CREDIT_DEMO_PAGADO} clienteNombre="José Martínez" />
          <CreditCard credito={CREDIT_DEMO_MORA} density="compact" clienteNombre="Carmen López" />
          <CreditCard credito={CREDIT_DEMO_HERO} density="compact" />
        </div>
      </Section>

      <Section
        title="Tabs"
        description="Primitiva agnóstica usada para Activo/Historial (5c) y vistas de crédito"
      >
        <TabsRoot defaultValue="activos" className="max-w-2xl">
          <TabsList>
            <TabsTrigger value="activos">Activo</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>
          <TabsContent value="activos">
            <div className="flex flex-col gap-4">
              <CreditCard credito={CREDIT_DEMO_HERO} clienteNombre="María Fernández" />
              <CreditCard credito={CREDIT_DEMO_HERO} density="compact" clienteNombre="Carmen López" />
            </div>
          </TabsContent>
          <TabsContent value="historial">
            <div className="flex flex-col gap-4">
              <CreditCard credito={CREDIT_DEMO_PAGADO} clienteNombre="José Martínez" />
            </div>
          </TabsContent>
        </TabsRoot>

        <TabsRoot defaultValue="tab-a" className="max-w-2xl">
          <TabsList variant="underline">
            <TabsTrigger value="tab-a">General</TabsTrigger>
            <TabsTrigger value="tab-b">Pagos</TabsTrigger>
            <TabsTrigger value="tab-c">Notas</TabsTrigger>
          </TabsList>
          <TabsContent value="tab-a">
            <p className="text-body-sm text-muted-foreground">
              Contenido de “General”.
            </p>
          </TabsContent>
          <TabsContent value="tab-b">
            <p className="text-body-sm text-muted-foreground">Contenido de “Pagos”.</p>
          </TabsContent>
          <TabsContent value="tab-c">
            <p className="text-body-sm text-muted-foreground">Contenido de “Notas”.</p>
          </TabsContent>
        </TabsRoot>
      </Section>

      <Section title="Switch" description="Toggle activa/inactiva (pantalla 7b)">
        <SwitchDemo />
      </Section>

      <Section
        title="Combobox (Popover + Command)"
        description="Selector de cobrador con búsqueda (pantalla 7b)"
      >
        <ComboboxDemo />
      </Section>

      <Section title="Dropdown menu" description="Menú de usuario del topbar y acciones de fila">
        <div className="flex flex-wrap items-center gap-3">
          <UserMenuDemo />
          <RowActionsDemo />
        </div>
      </Section>

      <Section
        title="Overlays"
        description="Dialog, Sheet (bottom sheet móvil), Toast/Sonner, Tooltip"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Abrir modal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cerrar ruta</DialogTitle>
                <DialogDescription>
                  Esta acción congela los totales del día. No se puede deshacer.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">Cancelar</Button>
                </DialogClose>
                <Button variant="destructive">Cerrar ruta</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary">Abrir bottom sheet</Button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader>
                <SheetTitle>Registrar cobro</SheetTitle>
                <SheetDescription>Monto prellenado con la cuota diaria.</SheetDescription>
              </SheetHeader>
              <div className="px-4">
                <Input defaultValue={formatCurrency(20000)} />
              </div>
              <SheetFooter>
                <SheetClose asChild>
                  <Button variant="primary" size="lg">
                    Confirmar cobro
                  </Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Button variant="secondary" onClick={() => toast.success("Cobro registrado")}>
            Toast de éxito
          </Button>
          <Button variant="secondary" onClick={() => toast.error("No se pudo registrar el cobro")}>
            Toast de error
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Enviar recibo">
                <SendIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Compartir por WhatsApp</TooltipContent>
          </Tooltip>

          <Button variant="secondary">
            <WhatsAppIcon className="size-4" />
            Compartir
          </Button>
        </div>
      </Section>

      <Section
        title="Skeleton"
        description="Imita la forma real del contenido — DESIGN_SYSTEM.md §2.9"
      >
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Section>
    </div>
  );
}
