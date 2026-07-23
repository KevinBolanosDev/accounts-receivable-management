import { Module } from "@nestjs/common";

import { ProductosController } from "./productos.controller";
import { ProductosRepository } from "./productos.repository";
import { ProductosService } from "./productos.service";

@Module({
  controllers: [ProductosController],
  providers: [ProductosService, ProductosRepository],
})
export class ProductosModule {}
