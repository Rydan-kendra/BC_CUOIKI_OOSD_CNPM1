import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { XacThucGuard } from '../auth/xac-thuc.guard.js';
import { LichSuService } from './lich-su.service.js';

export type LichSuRequest = { headers: { authorization?: string } };

@Controller('lich-su')
@UseGuards(XacThucGuard)
export class LichSuController {
  constructor(private readonly service: LichSuService) {}

  @Get('tim-kiem')
  timKiem(
    @Req() request: LichSuRequest,
    @Query('loai') loai?: string,
    @Query('tuNgay') tuNgay?: string,
    @Query('denNgay') denNgay?: string,
    @Query('tuKhoa') tuKhoa?: string,
  ) {
    return this.service.timKiem(request, { loai, tuNgay, denNgay, tuKhoa });
  }

  @Get('chi-tiet/:loai/:ma')
  chiTiet(
    @Req() request: LichSuRequest,
    @Param('loai') loai: string,
    @Param('ma') ma: string,
  ) {
    return this.service.chiTiet(request, loai, ma);
  }
}
