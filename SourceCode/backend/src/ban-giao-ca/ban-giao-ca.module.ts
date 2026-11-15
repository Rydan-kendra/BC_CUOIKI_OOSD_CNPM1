import { Module } from '@nestjs/common';
import { XacThucGuard } from '../auth/xac-thuc.guard.js';
import { BanGiaoCaController } from './ban-giao-ca.controller.js';
import { BanGiaoCaService } from './ban-giao-ca.service.js';

@Module({
  controllers: [BanGiaoCaController],
  providers: [BanGiaoCaService, XacThucGuard],
})
export class BanGiaoCaModule {}
