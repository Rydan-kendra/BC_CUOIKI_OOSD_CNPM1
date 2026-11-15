import { Module } from '@nestjs/common';
import { XacThucGuard } from '../auth/xac-thuc.guard.js';
import { SuCoController } from './su-co.controller.js';
import { SuCoService } from './su-co.service.js';

@Module({
  controllers: [SuCoController],
  providers: [SuCoService, XacThucGuard],
})
export class SuCoModule {}
