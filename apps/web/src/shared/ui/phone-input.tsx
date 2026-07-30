"use client";

import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

import {
  COUNTRIES,
  countryOfPhone,
  parsePhone,
  toE164,
  type Country,
} from "@/shared/lib/phone";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/command";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

// Teléfono con indicativo de país. Un solo campo hacia afuera: emite E.164
// (`+573001234567`) y acepta tanto E.164 como los números sueltos guardados
// antes de que esto existiera — ver `shared/lib/phone/phone.ts`.
//
// El selector es un `Command` dentro de un `Popover` y no un `<Select>`: con
// ~90 países, un desplegable sin búsqueda obliga a scrollear a ciegas. Es el
// mismo patrón que ya usan `ClientePicker` y `CobradorPicker`.

interface PhoneInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  /** Valor guardado (E.164 o legado). */
  value: string | null | undefined;
  /** Emite E.164, o `""` si el número queda vacío. */
  onChange: (value: string) => void;
  /** Clases del contenedor (el `className` va al `<input>`). */
  containerClassName?: string;
}

export function PhoneInput({
  value,
  onChange,
  containerClassName,
  className,
  disabled,
  id,
  ...inputProps
}: PhoneInputProps) {
  const [open, setOpen] = React.useState(false);
  // El país vive en estado propio y no derivado del valor: mientras el número
  // está vacío, `value` es `""` y no hay indicativo del que derivarlo, así que
  // sin esto el selector se resetearía a Colombia en cuanto se borra el campo.
  const [country, setCountry] = React.useState<Country>(() => countryOfPhone(value));

  const national = parsePhone(value).national;

  function handleCountry(next: Country) {
    setCountry(next);
    setOpen(false);
    onChange(toE164(next.dial, national));
  }

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-stretch gap-2",
        containerClassName,
      )}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            aria-label={`Indicativo: ${country.name} (+${country.dial})`}
            className={cn("shrink-0 gap-1.5 px-2.5 font-normal tabular-nums", className)}
          >
            <span aria-hidden>{country.flag}</span>
            <span>+{country.dial}</span>
            <ChevronsUpDownIcon className="size-3.5 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command>
            <CommandInput placeholder="País o indicativo..." />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                {COUNTRIES.map((c) => (
                  <CommandItem
                    // `cmdk` filtra por este texto: incluye el indicativo para
                    // poder buscar "+57" además de "Colombia".
                    key={c.iso2}
                    value={`${c.name} +${c.dial} ${c.iso2}`}
                    onSelect={() => handleCountry(c)}
                  >
                    <CheckIcon
                      className={c.iso2 === country.iso2 ? "opacity-100" : "opacity-0"}
                    />
                    <span aria-hidden>{c.flag}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-caption text-muted-foreground tabular-nums">
                      +{c.dial}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Input
        {...inputProps}
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        disabled={disabled}
        className={cn("min-w-0 flex-1", className)}
        value={national}
        onChange={(event) => onChange(toE164(country.dial, event.target.value))}
      />
    </div>
  );
}
