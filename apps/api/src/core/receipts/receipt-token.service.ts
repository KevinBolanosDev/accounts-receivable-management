import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

// Token de recibo público (capability URL).
//
// `GET /payments/:pagoId/receipt` exige JWT de staff, así que si el cobrador
// manda ESA url por WhatsApp el cliente recibe un 401. La solución es un enlace
// firmado: `GET /r/:token`, donde el token ES la autorización.
//
// Decisiones de seguridad:
// - Claim `typ: "receipt"` OBLIGATORIO. Sin él, un JWT de sesión válido serviría
//   como token de recibo (y al revés, este token pasaría por el JwtAuthGuard).
//   El `typ` es lo que mantiene separados los dos universos de tokens.
// - Expiración larga (90d) a propósito: el cliente debe poder reabrir el enlace
//   de WhatsApp semanas después. Es el trade-off aceptado de una capability URL.
// - El recibo contiene PII (nombre, producto, montos). Quien tenga el enlace ve
//   el recibo — igual que un enlace "no listado". Registrado en ESTADO_ACTUAL §7.2.
const RECEIPT_TOKEN_TYPE = "receipt";
const RECEIPT_TOKEN_EXPIRES_IN = "90d";

interface ReceiptTokenPayload {
  pagoId: string;
  typ: typeof RECEIPT_TOKEN_TYPE;
}

@Injectable()
export class ReceiptTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  sign(pagoId: string): string {
    // `expiresIn` explícito: el default global del JwtModule es el de sesión
    // (corto), inservible para un enlace que se comparte.
    return this.jwt.sign({ pagoId, typ: RECEIPT_TOKEN_TYPE } satisfies ReceiptTokenPayload, {
      expiresIn: RECEIPT_TOKEN_EXPIRES_IN,
    });
  }

  // Devuelve el `pagoId` o lanza 401. Nunca devuelve null: quien llama sirve el
  // recibo directamente, así que un fallo silencioso sería una fuga.
  verify(token: string): string {
    let payload: ReceiptTokenPayload;
    try {
      payload = this.jwt.verify<ReceiptTokenPayload>(token);
    } catch {
      throw new UnauthorizedException("El enlace del recibo no es válido o expiró.");
    }
    if (payload?.typ !== RECEIPT_TOKEN_TYPE || !payload.pagoId) {
      throw new UnauthorizedException("El enlace del recibo no es válido o expiró.");
    }
    return payload.pagoId;
  }

  // URL completa que se comparte por WhatsApp. Apunta al BACK: el recibo es un
  // documento HTML standalone que se abre solo, sin pasar por el SPA.
  buildPublicUrl(pagoId: string): string {
    const base = this.config.getOrThrow<string>("PUBLIC_APP_URL").replace(/\/$/, "");
    return `${base}/r/${this.sign(pagoId)}`;
  }
}
