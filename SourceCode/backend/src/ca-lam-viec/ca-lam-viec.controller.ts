import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CaLamViecService } from './ca-lam-viec.service.js';
import { XacThucGuard } from '../auth/xac-thuc.guard.js';

@Controller('ca-lam-viec')
@UseGuards(XacThucGuard)
export class CaLamViecController {
  constructor(
    private readonly caLamViecService: CaLamViecService,
  ) {}

  @Get()
  findAll() {
    return this.caLamViecService.findAll();
  }

  @Get('lich')
  findLichLamViec() {
    return this.caLamViecService.findLichLamViec();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.caLamViecService.findOne(id);
  }
}
