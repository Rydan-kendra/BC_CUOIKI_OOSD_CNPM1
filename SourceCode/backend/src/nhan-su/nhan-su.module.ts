import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NhanSuController } from './nhan-su.controller.js';
import { NhanSuService } from './nhan-su.service.js';
import { NhanSu } from './nhan-su.entity.js';
import { QuanLyGuard } from '../auth/quan-ly.guard.js';
import { XacThucGuard } from '../auth/xac-thuc.guard.js';

@Module({
  imports: [TypeOrmModule.forFeature([NhanSu])],
  controllers: [NhanSuController],
  providers: [
    NhanSuService,
    QuanLyGuard,
    XacThucGuard,
  ],
})
export class NhanSuModule {}
