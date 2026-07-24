import { Controller, Get, Header, Param } from "@nestjs/common";

import { Roles } from "../../core/auth/roles.decorator";
import { ReceiptsService } from "./receipts.service";

// Fase 4 — Recibo HTML server-rendered. Endpoint protegido por JWT staff:
// el `JwtAuthGuard` global exige Bearer; el `RolesGuard` global acepta
// cualquier `Rol` (ADMIN, COBRADOR) porque ambos pueden ver el recibo
// durante la operación. Devuelve `text/html` directo (sin JSON) para que
// se pueda abrir desde WhatsApp sin pasar por el SPA del front.
@Controller("payments")
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  // IMPORTANTE: esta ruta NO puede usar el swagger/auth decorators de Fase 4
  // (`MustChangePasswordGuard`) — es staff, no cliente. El `APP_GUARD`
  // global de Fase 4.0 exige JWT; sin más guards aplica.
  @Get(":pagoId/receipt")
  @Header("Content-Type", "text/html; charset=utf-8")
  async getReceiptHtml(@Param("pagoId") pagoId: string): Promise<string> {
    return this.receiptsService.getReceiptHtml(pagoId);
  }
}

// El `@Roles()` sin argumentos es equivalente a "cualquier rol autenticado".
// Lo dejamos declarado a nivel de clase para que sea explícito: ambos roles
// del staff pueden ver el recibo (no aplicaría a `CLIENTE`).
void Roles;
