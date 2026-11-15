import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { XacThucGuard } from '../auth/xac-thuc.guard.js';
import { BanGiaoCaService } from './ban-giao-ca.service.js';
import { LapBienBanDto } from './dto/lap-bien-ban.dto.js';
import { PhanHoiBienBanDto } from './dto/phan-hoi-bien-ban.dto.js';

export type BanGiaoCaRequest = { headers: { authorization?: string } };

@Controller('ban-giao-ca')
@UseGuards(XacThucGuard)
export class BanGiaoCaController {
  constructor(private readonly service: BanGiaoCaService) {}

  @Get('du-lieu')
  layDuLieu(@Req() request: BanGiaoCaRequest) {
    return this.service.layDuLieu(request);
  }

  @Get('thong-tin-ca/:maCa')
  thongTinCa(@Req() request: BanGiaoCaRequest, @Param('maCa') maCa: string) {
    return this.service.thongTinCa(request, maCa);
  }

  @Post('lap')
  lapBienBan(@Req() request: BanGiaoCaRequest, @Body() dto: LapBienBanDto) {
    return this.service.lapBienBan(request, dto);
  }

  @Post('phan-hoi')
  phanHoi(@Req() request: BanGiaoCaRequest, @Body() dto: PhanHoiBienBanDto) {
    return this.service.phanHoi(request, dto);
  }
}
