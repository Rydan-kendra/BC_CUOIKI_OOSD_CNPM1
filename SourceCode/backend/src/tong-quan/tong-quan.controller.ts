import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { XacThucGuard } from '../auth/xac-thuc.guard.js';
import { TongQuanService } from './tong-quan.service.js';

export type TongQuanRequest = { headers: { authorization?: string } };

@Controller('tong-quan')
@UseGuards(XacThucGuard)
export class TongQuanController {
  constructor(private readonly service: TongQuanService) {}

  @Get('du-lieu')
  layDuLieu(@Req() request: TongQuanRequest) {
    return this.service.layDuLieu(request);
  }
}
