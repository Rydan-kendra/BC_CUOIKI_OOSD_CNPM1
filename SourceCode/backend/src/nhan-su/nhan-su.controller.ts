import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NhanSuService } from './nhan-su.service.js';
import { CreateNhanSuDto } from './dto/create-nhan-su.dto.js';
import { UpdateNhanSuDto } from './dto/update-nhan-su.dto.js';
import { QuanLyGuard } from '../auth/quan-ly.guard.js';
import { XacThucGuard } from '../auth/xac-thuc.guard.js';

@Controller('nhan-su')
export class NhanSuController {
  constructor(private readonly nhanSuService: NhanSuService) {}

  @Get()
  @UseGuards(XacThucGuard)
  findAll(@Query('search') search?: string) {
    return this.nhanSuService.findAll(search);
  }

  @Get('kiem-tra-quyen')
  @UseGuards(QuanLyGuard)
  kiemTraQuyen() {
    return {
      trangThai: 'ThanhCong',
      thongBao: 'Tài khoản có quyền quản lý nhân sự',
    };
  }

  @Get(':id')
  @UseGuards(XacThucGuard)
  findOne(@Param('id') id: string) {
    return this.nhanSuService.findOne(id);
  }

  @Post()
  @UseGuards(QuanLyGuard)
  create(@Body() dto: CreateNhanSuDto) {
    return this.nhanSuService.create(dto);
  }

  @Patch(':id')
  @UseGuards(QuanLyGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNhanSuDto,
  ) {
    return this.nhanSuService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(QuanLyGuard)
  remove(@Param('id') id: string) {
    return this.nhanSuService.remove(id);
  }
}
