import { Module } from '@nestjs/common';
import { XacThucGuard } from '../auth/xac-thuc.guard.js';
import { TongQuanController } from './tong-quan.controller.js';
import { TongQuanService } from './tong-quan.service.js';

@Module({
  controllers: [TongQuanController],
  providers: [TongQuanService, XacThucGuard],
})
export class TongQuanModule {}
