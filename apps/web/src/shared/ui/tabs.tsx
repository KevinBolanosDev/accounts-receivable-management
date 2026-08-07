"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

// DESIGN_SYSTEM.md §3.5 — Tabs controladas (radix), estilo pill/bar según variante.
// Agnóstico de dominio (se usa tanto en Activo/Historial del cliente como en
// pestañas internas de un crédito). Vive en `shared/ui` (FSD).
function TabsRoot({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "inline-flex items-center justify-start gap-1 self-start rounded-md p-1",
  {
    variants: {
      variant: {
        pill: "bg-muted text-muted-foreground",
        underline: "border-b border-border bg-transparent",
      },
    },
    defaultVariants: {
      variant: "pill",
    },
  },
);

function TabsList({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // `bg-card` y no `bg-background`: la pestaña activa se recorta contra
        // la pista `bg-muted` de la lista. En claro `background` (#FAFAFA) y
        // `muted` (#F4F4F5) se diferencian en 2% de luminosidad — la pestaña
        // activa era invisible. `card` es blanco puro y funciona en los dos
        // modos (en oscuro queda más oscura que la pista, que también lee).
        pill: "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        underline:
          "rounded-none border-b-2 border-transparent text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground",
      },
    },
    defaultVariants: {
      variant: "pill",
    },
  },
);

function TabsTrigger({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> &
  VariantProps<typeof tabsTriggerVariants>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      data-variant={variant}
      className={cn(tabsTriggerVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("focus-visible:outline-none", className)}
      {...props}
    />
  );
}

export { TabsRoot, TabsList, TabsTrigger, TabsContent };
export type { VariantProps };
