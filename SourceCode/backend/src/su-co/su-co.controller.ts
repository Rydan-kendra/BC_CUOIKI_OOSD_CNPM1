import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { XacThucGuard } from '../auth/xac-thuc.guard.js';
import { SuCoService } from './su-co.service.js';
import { GhiNhanSuCoDto } from './dto/ghi-nhan-su-co.dto.js';
import { CapNhatSuCoDto } from './dto/cap-nhat-su-co.dto.js';

export type SuCoRequest = { headers: { authorization?: string } };

@Controller('su-co')
@UseGuards(XacThucGuard)
export class SuCoController {
  constructor(private readonly service: SuCoService) {}

  @Get('du-lieu')
  layDuLieu(@Req() request: SuCoRequest) {
    return this.service.layDuLieu(request);
  }

  @Get('chi-tiet/:maSuCo')
  chiTiet(@Req() request: SuCoRequest, @Param('maSuCo') maSuCo: string) {
    return this.service.chiTiet(request, maSuCo);
  }

  @Post('ghi-nhan')
  ghiNhan(@Req() request: SuCoRequest, @Body() dto: GhiNhanSuCoDto) {
    return this.service.ghiNhan(request, dto);
  }

  @Post('cap-nhat')
  capNhat(@Req() request: SuCoRequest, @Body() dto: CapNhatSuCoDto) {
    return this.service.capNhat(request, dto);
  }
}
