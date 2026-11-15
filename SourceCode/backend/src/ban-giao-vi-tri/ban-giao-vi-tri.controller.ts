import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { XacThucGuard } from '../auth/xac-thuc.guard.js';
import { BanGiaoViTriService } from './ban-giao-vi-tri.service.js';
import { TiepNhanBanGiaoDto } from './dto/tiep-nhan-ban-giao.dto.js';

type BanGiaoRequest = { headers: { authorization?: string } };

@Controller('ban-giao-vi-tri')
@UseGuards(XacThucGuard)
export class BanGiaoViTriController {
  constructor(private readonly service: BanGiaoViTriService) {}

  @Get('du-lieu')
  layDuLieu(@Req() request: BanGiaoRequest) {
    return this.service.layDuLieu(request);
  }

  @Post('tiep-nhan')
  tiepNhan(@Req() request: BanGiaoRequest, @Body() dto: TiepNhanBanGiaoDto) {
    return this.service.tiepNhan(request, dto);
  }
}
