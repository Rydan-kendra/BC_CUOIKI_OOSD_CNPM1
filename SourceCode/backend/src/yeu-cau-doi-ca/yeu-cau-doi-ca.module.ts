import { Module } from '@nestjs/common';
import { YeuCauDoiCaController } from './yeu-cau-doi-ca.controller.js';
import { YeuCauDoiCaService } from './yeu-cau-doi-ca.service.js';
import { XacThucGuard } from '../auth/xac-thuc.guard.js';
import { QuanLyGuard } from '../auth/quan-ly.guard.js';
import { XuLyYeuCauController } from './xu-ly-yeu-cau.controller.js';
import { XuLyYeuCauService } from './xu-ly-yeu-cau.service.js';

@Module({
  controllers: [YeuCauDoiCaController, XuLyYeuCauController],
  providers: [YeuCauDoiCaService, XuLyYeuCauService, XacThucGuard, QuanLyGuard],
})
export class YeuCauDoiCaModule {}
