import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaLamViec } from './ca-lam-viec.entity.js';
import { CaLamViecController } from './ca-lam-viec.controller.js';
import { CaLamViecService } from './ca-lam-viec.service.js';
import { QuanLyCaController } from './quan-ly-ca.controller.js';
import { QuanLyCaService } from './quan-ly-ca.service.js';
import { XacThucGuard } from '../auth/xac-thuc.guard.js';
import { QuanLyGuard } from '../auth/quan-ly.guard.js';

@Module({
  imports: [TypeOrmModule.forFeature([CaLamViec])],
  controllers: [CaLamViecController, QuanLyCaController],
  providers: [
    CaLamViecService,
    QuanLyCaService,
    XacThucGuard,
    QuanLyGuard,
  ],
})
export class CaLamViecModule {}
