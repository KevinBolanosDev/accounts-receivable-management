import { Controller, Get, Header, Param } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { Public } from "../../core/auth/public.decorator";
import { ReceiptTokenService } from "../../core/receipts/receipt-token.service";
import { ReceiptsService } from "./receipts.service";

// Recibo público por enlace firmado — es lo que se comparte por WhatsApp.
//
// `@Public()` a nivel de clase: este endpoint NO lleva JWT de sesión a
// propósito. La autorización la da el token de la URL, que
// `ReceiptTokenService.verify` valida (firma + claim `typ: "receipt"`, así un
// JWT de sesión no sirve acá ni este token sirve en el resto de la API).
//
// Path corto (`/r/:token`) porque el token es largo y el enlace viaja por
// WhatsApp, donde la URL se ve completa en la burbuja del mensaje.
//
// Throttle explícito: es la única superficie sin autenticar que hace una query
// a la base, así que acota el barrido de tokens a ciegas (aunque adivinar una
// firma HS256 no sea realista).
@Public()
@Controller("r")
export class PublicReceiptsController {
  constructor(
    private readonly receiptsService: ReceiptsService,
    private readonly receiptToken: ReceiptTokenService,
  ) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(":token")
  @Header("Content-Type", "text/html; charset=utf-8")
  // `noindex`: el recibo lleva PII (nombre, producto, montos). El enlace es "no
  // listado", pero si alguien lo pega en un sitio público no debe terminar
  // indexado por un buscador.
  @Header("X-Robots-Tag", "noindex, nofollow")
  @Header("Cache-Control", "private, no-store")
  async getPublicReceipt(@Param("token") token: string): Promise<string> {
    const pagoId = this.receiptToken.verify(token);
    return this.receiptsService.getPublicReceiptHtml(pagoId);
  }
}
