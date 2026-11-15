import { Module } from '@nestjs/common';
import { XacThucGuard } from '../auth/xac-thuc.guard.js';
import { BanGiaoViTriController } from './ban-giao-vi-tri.controller.js';
import { BanGiaoViTriService } from './ban-giao-vi-tri.service.js';

@Module({
  controllers: [BanGiaoViTriController],
  providers: [BanGiaoViTriService, XacThucGuard],
})
export class BanGiaoViTriModule {}
