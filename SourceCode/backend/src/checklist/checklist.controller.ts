import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { XacThucGuard } from '../auth/xac-thuc.guard.js';
import { ChecklistService } from './checklist.service.js';
import { HoanTatChecklistDto } from './dto/hoan-tat-checklist.dto.js';

type ChecklistRequest = {
  headers: { authorization?: string };
};

@Controller('checklist')
@UseGuards(XacThucGuard)
export class ChecklistController {
  constructor(private readonly service: ChecklistService) {}

  @Get('du-lieu')
  layDuLieu(@Req() request: ChecklistRequest) {
    return this.service.layDuLieu(request);
  }

  @Post('hoan-tat')
  hoanTat(@Req() request: ChecklistRequest, @Body() dto: HoanTatChecklistDto) {
    return this.service.hoanTat(request, dto);
  }
}
