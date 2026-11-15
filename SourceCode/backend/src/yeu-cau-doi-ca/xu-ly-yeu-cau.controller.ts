import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { QuanLyGuard } from '../auth/quan-ly.guard.js';
import { XuLyYeuCauDto } from './dto/xu-ly-yeu-cau.dto.js';
import { XuLyYeuCauService } from './xu-ly-yeu-cau.service.js';
import type { YeuCauRequest } from './yeu-cau-doi-ca.controller.js';

@Controller('yeu-cau-doi-ca/quan-ly')
@UseGuards(QuanLyGuard)
export class XuLyYeuCauController {
  constructor(private readonly service: XuLyYeuCauService) {}

  @Get()
  layDanhSach(@Req() request: YeuCauRequest) {
    return this.service.layDanhSach(request);
  }

  @Post('xu-ly')
  xuLy(@Req() request: YeuCauRequest, @Body() dto: XuLyYeuCauDto) {
    return this.service.xuLy(request, dto);
  }
}
