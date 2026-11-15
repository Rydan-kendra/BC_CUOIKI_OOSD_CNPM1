import { Module } from '@nestjs/common';
import { XacThucGuard } from '../auth/xac-thuc.guard.js';
import { LichSuController } from './lich-su.controller.js';
import { LichSuService } from './lich-su.service.js';

@Module({
  controllers: [LichSuController],
  providers: [LichSuService, XacThucGuard],
})
export class LichSuModule {}
