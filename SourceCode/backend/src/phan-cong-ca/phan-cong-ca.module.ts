import { Module } from '@nestjs/common';
import { PhanCongCaController } from './phan-cong-ca.controller.js';
import { PhanCongCaService } from './phan-cong-ca.service.js';
import { QuanLyGuard } from '../auth/quan-ly.guard.js';

@Module({
  controllers: [PhanCongCaController],
  providers: [PhanCongCaService, QuanLyGuard],
})
export class PhanCongCaModule {}
