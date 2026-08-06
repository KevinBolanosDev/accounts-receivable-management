"use client";

import { useEffect, useRef, useState } from "react";
import { notFound } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  BanknoteIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  CreditCardIcon,
  DownloadIcon,
  LogOutIcon,
  MoreHorizontalIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ClientCard, ClientContactPanel } from "@/entities/client";
import { CreditCard, CreditSummaryCard } from "@/entities/credit";
import { PaymentHistory, esCuotaSinPagar } from "@/entities/payment";
import { ReceiptActions } from "@/entities/receipt";
import { ReceiptCard } from "@/features/receipts";
import type { CreditoListItem, DailyClosureListItem, PaymentHistoryItem, Receipt } from "@repo/types";
import { formatCurrency } from "@/shared/lib/format-currency";
import { DataField, DataFieldList } from "@/shared/ui/data-field";
import { MetricCard } from "@/shared/ui/metric-card";
import { MetricTile, MetricTileGroup } from "@/shared/ui/metric-tile";
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
import { FilterChips } from "@/shared/ui/filter-chips";
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
  frecuencia: "DIARIO",
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

// Historial con los SEIS estados de cuota, para revisar los badges, la
// escalada por tiempo (Pendiente → Vencida → Mora) y las dos columnas de fecha
// (vencimiento vs. pago real) sin depender del backend.
const PAGOS_DEMO: PaymentHistoryItem[] = [
  {
    id: "pg-d-5",
    creditoId: "cr-2041",
    monto: 0,
    fecha: "2026-07-28T13:00:00.000Z",
    cobradorId: "",
    cobradorNombre: null,
    reciboUrl: null,
    reciboPublicUrl: null,
    numeroCuota: 15,
    estado: "PENDING", // vence hoy: todavía se puede cobrar
    fechaVencimiento: "2026-07-28T13:00:00.000Z",
    fechaPago: null,
    diasAtraso: 0,
    reciboCodigo: null,
    anulado: false,
  },
  {
    id: "pg-d-4",
    creditoId: "cr-2041",
    monto: 0,
    fecha: "2026-07-25T13:00:00.000Z",
    cobradorId: "",
    cobradorNombre: null,
    reciboUrl: null,
    reciboPublicUrl: null,
    numeroCuota: 14,
    estado: "OVERDUE", // pasó de día pero no llega a la semana
    fechaVencimiento: "2026-07-25T13:00:00.000Z",
    fechaPago: null,
    diasAtraso: 3,
    reciboCodigo: null,
    anulado: false,
  },
  {
    id: "pg-d-3",
    creditoId: "cr-2041",
    monto: 0,
    fecha: "2026-07-18T13:00:00.000Z",
    cobradorId: "",
    cobradorNombre: null,
    reciboUrl: null,
    reciboPublicUrl: null,
    numeroCuota: 13,
    estado: "DEFAULTED", // una semana o más sin pagar
    fechaVencimiento: "2026-07-18T13:00:00.000Z",
    fechaPago: null,
    diasAtraso: 10,
    reciboCodigo: null,
    anulado: false,
  },
  {
    id: "pg-d-2",
    creditoId: "cr-2041",
    monto: 55_000,
    fecha: "2026-07-26T20:42:00.000Z",
    cobradorId: "u-2",
    cobradorNombre: "Carlos Ramírez",
    reciboUrl: null,
    reciboPublicUrl: "https://example.com/r/token-2",
    numeroCuota: 12,
    estado: "LATE",
    // Venció el 24 y se pagó el 26: es justo el caso que las dos columnas
    // separadas hacen visible.
    fechaVencimiento: "2026-07-24T13:00:00.000Z",
    fechaPago: "2026-07-26T20:42:00.000Z",
    diasAtraso: 2,
    reciboCodigo: "R-PGD2",
    anulado: false,
  },
  {
    id: "pg-d-1",
    creditoId: "cr-2041",
    monto: 55_000,
    fecha: "2026-07-25T14:10:00.000Z",
    cobradorId: "u-2",
    cobradorNombre: "Carlos Ramírez",
    reciboUrl: null,
    reciboPublicUrl: "https://example.com/r/token-1",
    numeroCuota: 11,
    estado: "ON_TIME",
    fechaVencimiento: "2026-07-25T13:00:00.000Z",
    fechaPago: "2026-07-25T14:10:00.000Z",
    diasAtraso: 0,
    reciboCodigo: "R-PGD1",
    anulado: false,
  },
  {
    id: "pg-d-0",
    creditoId: "cr-2041",
    monto: 55_000,
    fecha: "2026-07-23T09:15:00.000Z",
    cobradorId: "u-2",
    cobradorNombre: "Carlos Ramírez",
    reciboUrl: null,
    reciboPublicUrl: "https://example.com/r/token-0",
    // Sentinel: una fila anulada no ocupa un lugar real del cronograma.
    numeroCuota: 0,
    estado: "ANULADO",
    fechaVencimiento: "2026-07-23T09:15:00.000Z",
    fechaPago: "2026-07-23T09:15:00.000Z",
    diasAtraso: 0,
    reciboCodigo: "R-PGD0",
    anulado: true,
  },
];

const RECEIPT_DEMO: Receipt = {
  id: "pg-2041-12",
  pagoId: "pg-2041-12",
  codigo: "R-PG204112",
  createdAt: "2026-07-24T15:00:00.000Z",
  credito: {
    codigo: "CR-2041",
    clienteNombre: "María Fernández",
    productoNombre: "Nevera",
  },
  monto: 20_000,
  saldoRestante: 1_160_000,
  fecha: "2026-07-24T15:00:00.000Z",
  cobradorNombre: "Cobrador Demo",
  anulado: false,
};

const CIERRES_DEMO: DailyClosureListItem[] = [
  {
    id: "dc-demo-1",
    routeId: "r3",
    rutaNombre: "Ruta 3 · Centro",
    date: "2026-08-05",
    totalCollected: 540_000,
    collectedCount: 24,
    newCredits: 2,
    newCreditsAmount: 1_200_000,
    productsSold: 2,
    unpaidCount: 3,
    status: "CLOSED",
    closedByNombre: "Carlos Ramírez",
    createdAt: "2026-08-05T22:03:00.000Z",
  },
  {
    id: "dc-demo-2",
    routeId: "r1",
    rutaNombre: "Ruta 1 · Norte",
    date: "2026-08-04",
    totalCollected: 420_000,
    collectedCount: 19,
    newCredits: 0,
    newCreditsAmount: 0,
    productsSold: 0,
    unpaidCount: 0,
    status: "CLOSED",
    closedByNombre: "Carlos Ramírez",
    createdAt: "2026-08-04T22:01:00.000Z",
  },
];

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
  const [estadoFiltro, setEstadoFiltro] = useState("all");

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

      <Section
        title="Chips de filtro"
        description="Filtro de lista en móvil, scroll horizontal — DESIGN_SYSTEM.md §2.5"
      >
        <FilterChips
          label="Filtrar por estado"
          value={estadoFiltro}
          onValueChange={setEstadoFiltro}
          options={[
            { value: "all", label: "Todos", count: 142 },
            { value: "activo", label: "Activos", count: 98 },
            { value: "proximo-a-vencer", label: "Por vencer", count: 12 },
            { value: "mora", label: "Mora", count: 19 },
            { value: "pagado", label: "Pagados", count: 13 },
          ]}
        />
      </Section>

      <Section title="Formularios" description="Input, Select, Textarea — radius sm, foco con ring">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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
        description="entities/client — API de slots: contacto con copiar, cifra + etiqueta, badge libre"
      >
        <div className="grid max-w-md gap-3">
          <ClientCard
            cliente={{ nombre: "María Fernández", ruta: { id: "r1", nombre: "Ruta 3 · Centro" } }}
            interactive
          />
          <ClientCard
            cliente={{ nombre: "Luis Pardo", ruta: { id: "r2", nombre: "Ruta 6 · Kennedy" } }}
            amount={180000}
            amountLabel="saldo"
            estado="proximo-a-vencer"
            porcentajePagado={62}
          />
          {/* Variante "Cobrados hoy" del cobrador: contacto copiable en vez de
              la ruta, y lo COBRADO en vez del saldo pendiente. */}
          <ClientCard
            cliente={{ nombre: "Kevin Bohórquez", ruta: null }}
            contacto={{ documento: "1023456789", telefono: "3001234567" }}
            amount={774000}
            amountLabel="cobrado hoy"
            badge={<Badge status="pagado">Cobrado</Badge>}
            porcentajePagado={8}
            muted
          />
        </div>
      </Section>

      <Section
        title="Client contact panel"
        description="entities/client — documento, teléfono, ubicación y contacto adicional con copiar"
      >
        <div className="max-w-2xl">
          <ClientContactPanel
            cliente={{
              documento: "1023456789",
              telefono: "3001234567",
              direccion: "Cra 12 #34-56, Barrio Centro",
              contactoNombre: "Marta Bohórquez",
              contactoTelefono: "3109876543",
            }}
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
        title="Credit summary card"
        description="entities/credit — fila tappable por crédito (lista del Portal + Historial del Cobrador)"
      >
        <div className="grid max-w-2xl gap-3">
          <CreditSummaryCard credito={CREDIT_DEMO_HERO} href="#" />
          <CreditSummaryCard
            credito={CREDIT_DEMO_PAGADO}
            amountKind="pagado"
            meta="20 pagos · último 27 jul, 3:42 p. m."
            badge={<Badge status="pagado">Pagado</Badge>}
            href="#"
          />
          {/* El slot `footer` permite inyectar un componente de FEATURE (el
              sheet de registrar cobro) sin que la entity lo importe. */}
          <CreditSummaryCard
            credito={CREDIT_DEMO_MORA}
            badge={<Badge status="mora">En mora</Badge>}
            footer={
              <Button size="lg" className="w-full">
                Registrar cobro
              </Button>
            }
          />
        </div>
      </Section>

      <Section
        title="Metric tiles"
        description="shared/ui — reemplaza los 5 tiles de métrica que estaban copiados por pantalla"
      >
        <div className="grid max-w-2xl gap-4">
          <MetricTileGroup columns={3} divided>
            <MetricTile label="Pendientes" value="8" />
            <MetricTile label="Cobrados" value="12" tone="success" />
            <MetricTile label="Hoy" value={formatCurrency(774000)} />
          </MetricTileGroup>
          <MetricTileGroup columns={2}>
            <MetricTile label="Saldo pendiente" value={formatCurrency(522667)} align="start" />
            <MetricTile label="Cuota" value="3/30" align="start" sub="27 jul, 3:42 p. m." />
          </MetricTileGroup>
        </div>
      </Section>

      <Section
        title="Payment history"
        description="entities/payment — misma implementación para Cobrador y Portal; fecha CON hora"
      >
        <div className="max-w-2xl">
          <PaymentHistory
            pagos={PAGOS_DEMO}
            cuotasTotal={30}
            producto="Nevera"
            renderActions={(pago) =>
              esCuotaSinPagar(pago.estado) ? null : (
                <ReceiptActions
                  actions={["download", "share"]}
                  onDownload={() => undefined}
                  share={{ monto: pago.monto, publicUrl: pago.reciboPublicUrl }}
                />
              )
            }
          />
        </div>
      </Section>

      <Section
        title="Receipt actions"
        description="entities/receipt — ver / descargar (print-to-PDF) / compartir por WhatsApp"
      >
        <div className="flex max-w-2xl flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="text-body-sm text-muted-foreground">Con recibo disponible:</span>
            <ReceiptActions
              actions={["view", "download", "share"]}
              onView={() => undefined}
              onDownload={() => undefined}
              share={{ monto: 55000, publicUrl: "https://example.com/r/token" }}
            />
          </div>
          <div className="flex items-center gap-3">
            {/* Sin `publicUrl` compartir queda deshabilitado con tooltip, en vez
                de mostrar un botón que al pulsarlo no hace nada. */}
            <span className="text-body-sm text-muted-foreground">Sin recibo:</span>
            <ReceiptActions actions={["view", "download", "share"]} share={{ monto: 0 }} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-body-sm text-muted-foreground">Con etiqueta:</span>
            <ReceiptActions
              variant="labeled"
              onDownload={() => undefined}
              share={{ monto: 55000, publicUrl: "https://example.com/r/token" }}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Copy button + Data field"
        description="shared/ui — afordancia de copiar reutilizable (para en el click, no navega)"
      >
        <div className="max-w-2xl rounded-xl border border-border bg-card p-4">
          <DataFieldList>
            <DataField label="Documento" value="1023456789" copyValue="1023456789" />
            <DataField
              label="Teléfono"
              value="3001234567"
              copyValue="3001234567"
              href="tel:3001234567"
            />
            <DataField label="Sin dato" value={null} />
          </DataFieldList>
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
                <SheetDescription>Monto prellenado con la cuota del período.</SheetDescription>
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

      <Section
        title="Recibos"
        description="ReceiptCard (pantalla #18c) — versión completa y versión mini embebida (Fase 4.18)"
      >
        <div className="flex flex-wrap items-start gap-6">
          <ReceiptCard
            receipt={RECEIPT_DEMO}
            publicUrl="http://localhost:3001/r/token-demo"
            phone="3001234567"
          />

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Ver recibo en modal (mini)</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Recibo de pago</DialogTitle>
              </DialogHeader>
              <ReceiptCard
                receipt={RECEIPT_DEMO}
                publicUrl="http://localhost:3001/r/token-demo"
                compact
              />
            </DialogContent>
          </Dialog>
        </div>
      </Section>

      <Section
        title="Cierre diario"
        description="Metric cards del cierre + tabla del histórico + PDF on-demand — Fase 5 (#19c/#12c/#13c)"
      >
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard
              icon={<BanknoteIcon />}
              label="Total cobrado"
              value={formatCurrency(540_000)}
              tone="primary"
            />
            <MetricCard icon={<CreditCardIcon />} label="Créditos nuevos" value="2" tone="accent" />
            <MetricCard icon={<PackageIcon />} label="Productos vendidos" value="2" tone="success" />
            <MetricCard
              icon={<UsersIcon />}
              label="Clientes sin pagar"
              value="3"
              tone="destructive"
            />
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Total cobrado</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CIERRES_DEMO.map((cierre) => (
                  <TableRow key={cierre.id}>
                    <TableCell>{cierre.date}</TableCell>
                    <TableCell className="font-medium">{cierre.rutaNombre}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(cierre.totalCollected)}</TableCell>
                    <TableCell>
                      <Badge status={cierre.status === "OPEN" ? "ruta-abierta" : "ruta-cerrada"}>
                        {cierre.status === "OPEN" ? "Abierta" : "Cerrada"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" aria-label="Descargar PDF">
                        <DownloadIcon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center gap-4 rounded-lg border border-dashed border-border bg-card p-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
              <DownloadIcon className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">cierre-ruta-3-centro-2026-08-05.pdf</p>
              <p className="text-caption text-muted-foreground">
                Generado on-demand con pdfkit (<code>GET /daily-closures/:id/pdf</code>): encabezado,
                resumen del día, tabla de clientes sin pagar y pie con quién cerró — sin tocar Storage.
              </p>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
