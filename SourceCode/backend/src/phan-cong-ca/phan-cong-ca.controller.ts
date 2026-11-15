import {
  Body,
  Controller,
  Post,
  Put,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PhanCongCaService } from './phan-cong-ca.service.js';
import { HoanTatPhanCongDto } from './dto/hoan-tat-phan-cong.dto.js';
import { QuanLyGuard } from '../auth/quan-ly.guard.js';

@Controller('phan-cong-ca')
@UseGuards(QuanLyGuard)
export class PhanCongCaController {
  constructor(
    private readonly phanCongCaService: PhanCongCaService,
  ) {}

  @Put('luu')
  @UsePipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }))
  luu(@Body() dto: HoanTatPhanCongDto) {
    return this.phanCongCaService.luuPhanCong(dto);
  }

  @Post('hoan-tat')
  @UsePipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }))
  hoanTat(@Body() dto: HoanTatPhanCongDto) {
    return this.phanCongCaService.hoanTatPhanCong(dto);
  }
}
