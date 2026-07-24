import { SetMetadata } from "@nestjs/common";

// Marca un handler (o una clase) como público: el `JwtAuthGuard` global lo
// deja pasar sin token. Útil cuando un controller tiene endpoints mixtos
// (algunos con JWT, otros sin) y se quiere evitar repetir `@UseGuards` por
// handler. Para el resto del controller (handlers sin `@Public()`) el
// guard sigue exigiendo Bearer.
export const IS_PUBLIC_KEY = "isPublic";
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
