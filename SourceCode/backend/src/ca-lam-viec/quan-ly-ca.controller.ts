import {
  Body,
  Controller,
  Param,
  Patch,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { QuanLyGuard } from '../auth/quan-ly.guard.js';
import { QuanLyCaService } from './quan-ly-ca.service.js';
import { SuaCaDto } from './dto/luu-ca.dto.js';

@Controller('quan-ly-ca')
@UseGuards(QuanLyGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class QuanLyCaController {
  constructor(private readonly quanLyCaService: QuanLyCaService) {}

  @Patch(':maCa')
  suaCa(@Param('maCa') maCa: string, @Body() dto: SuaCaDto) {
    return this.quanLyCaService.suaCa(maCa, dto);
  }
}
