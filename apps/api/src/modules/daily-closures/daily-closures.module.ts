import { Module } from "@nestjs/common";

import { DailyClosuresController } from "./daily-closures.controller";
import { DailyClosuresCron } from "./daily-closures.cron";
import { DailyClosuresRepository } from "./daily-closures.repository";
import { DailyClosuresService } from "./daily-closures.service";

@Module({
  controllers: [DailyClosuresController],
  providers: [DailyClosuresService, DailyClosuresRepository, DailyClosuresCron],
})
export class DailyClosuresModule {}
