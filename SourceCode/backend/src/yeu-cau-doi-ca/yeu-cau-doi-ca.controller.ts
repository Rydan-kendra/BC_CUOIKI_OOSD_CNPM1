import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { YeuCauDoiCaService } from './yeu-cau-doi-ca.service.js';
import { GuiYeuCauDto } from './dto/gui-yeu-cau.dto.js';
import { XacThucGuard } from '../auth/xac-thuc.guard.js';

export type YeuCauRequest = {
  headers: { authorization?: string };
};

@Controller('yeu-cau-doi-ca')
@UseGuards(XacThucGuard)
export class YeuCauDoiCaController {
  constructor(private readonly service: YeuCauDoiCaService) {}

  @Get('du-lieu')
  layDuLieu(@Req() request: YeuCauRequest) {
    return this.service.layDuLieu(request);
  }

  @Post('gui')
  gui(@Req() request: YeuCauRequest, @Body() dto: GuiYeuCauDto) {
    return this.service.guiYeuCau(request, dto);
  }
}
