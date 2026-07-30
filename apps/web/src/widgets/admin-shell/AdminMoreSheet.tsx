"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/ui/sheet";

import { ADMIN_MORE_NAV, isNavItemActive } from "./nav-items";

// Segundo nivel de la navegación móvil: lo que no cabe en las 4 pestañas de
// `AdminBottomNav`. Es una composición propia — NO el `AdminSidebar` metido en
// un Sheet. El sidebar es la navegación de escritorio: reusarlo acá traía la
// marca, los ítems primarios repetidos y su propio pie de usuario, que ahora
// vive en el avatar del topbar.
//
// `side="bottom"` porque nace del pulsar la pestaña "Más" en la barra inferior:
// el panel aparece donde está el dedo.

const ITEM_CLASS =
  "flex min-h-14 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors";

interface AdminMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminMoreSheet({ open, onOpenChange }: AdminMoreSheetProps) {
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <SheetHeader className="pb-0">
          <SheetTitle>Más</SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-1 px-4 pb-2" aria-label="Más navegación">
          {ADMIN_MORE_NAV.map((item) => {
            const Icon = item.icon;

            if (!item.enabled) {
              return (
                <span
                  key={item.href}
                  aria-disabled="true"
                  className={cn(ITEM_CLASS, "cursor-default text-muted-foreground")}
                >
                  <Icon className="size-5 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  <span className="text-caption text-muted-foreground">Pronto</span>
                </span>
              );
            }

            const active = isNavItemActive(pathname, item);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onOpenChange(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  ITEM_CLASS,
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                <ChevronRightIcon className="size-4 shrink-0" />
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
