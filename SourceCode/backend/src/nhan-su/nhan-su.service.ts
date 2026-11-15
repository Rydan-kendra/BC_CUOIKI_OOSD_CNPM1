import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Like } from 'typeorm';
import { NhanSu } from './nhan-su.entity.js';
import { CreateNhanSuDto } from './dto/create-nhan-su.dto.js';
import { UpdateNhanSuDto } from './dto/update-nhan-su.dto.js';

@Injectable()
export class NhanSuService {
  constructor(
    @InjectRepository(NhanSu)
    private readonly nhanSuRepository: Repository<NhanSu>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(search?: string): Promise<NhanSu[]> {
    const keyword = search?.trim();

    if (keyword) {
      return this.nhanSuRepository.find({
        where: [
          { maNhanSu: Like(`%${keyword}%`) },
          { hoTen: Like(`%${keyword}%`) },
        ],
        order: {
          maNhanSu: 'ASC',
        },
      });
    }

    return this.nhanSuRepository.find({
      order: {
        maNhanSu: 'ASC',
      },
    });
  }

  async findOne(id: string): Promise<NhanSu> {
    const nhanSu = await this.nhanSuRepository.findOneBy({
      maNhanSu: id,
    });

    if (!nhanSu) {
      throw new NotFoundException('Không tìm thấy nhân sự');
    }

    return nhanSu;
  }

  async create(dto: CreateNhanSuDto): Promise<NhanSu> {
    if (dto.loaiNhanSu === 'QuanLy') {
      throw new BadRequestException(
        'Không được tạo nhân sự loại Quản lý từ chức năng này',
      );
    }

    const existing = await this.nhanSuRepository.findOneBy({
      maNhanSu: dto.maNhanSu,
    });

    if (existing) {
      throw new ConflictException('Mã nhân sự đã tồn tại');
    }

    const nhanSu = this.nhanSuRepository.create({
      maNhanSu: dto.maNhanSu,
      hoTen: dto.hoTen,
      loaiNhanSu: dto.loaiNhanSu,
      soDienThoai: dto.soDienThoai ?? null,
    });

    return this.nhanSuRepository.save(nhanSu);
  }

  async update(id: string, dto: UpdateNhanSuDto): Promise<NhanSu> {
    const nhanSu = await this.findOne(id);

    if (nhanSu.loaiNhanSu === 'QuanLy') {
      throw new ForbiddenException(
        'Không được chỉnh sửa nhân sự Quản lý từ chức năng này',
      );
    }

    if (dto.loaiNhanSu === 'QuanLy') {
      throw new BadRequestException(
        'Không được chuyển nhân viên thành Quản lý từ chức năng này',
      );
    }

    if (dto.hoTen !== undefined) {
      nhanSu.hoTen = dto.hoTen;
    }

    if (dto.loaiNhanSu !== undefined) {
      nhanSu.loaiNhanSu = dto.loaiNhanSu;
    }

    if (dto.soDienThoai !== undefined) {
      nhanSu.soDienThoai = dto.soDienThoai;
    }

    return this.nhanSuRepository.save(nhanSu);
  }

  async remove(id: string) {
    const nhanSu = await this.findOne(id);

    if (nhanSu.loaiNhanSu === 'QuanLy') {
      throw new ForbiddenException(
        'Không được xóa nhân sự Quản lý từ chức năng này',
      );
    }

    const result = await this.dataSource.query(
      `
      SELECT
        (SELECT COUNT(*) FROM TaiKhoan WHERE maNhanSu = @0) AS soTaiKhoan,
        (SELECT COUNT(*) FROM PhanCongCa WHERE maNhanSu = @0) AS soPhanCong,
        (SELECT COUNT(*) FROM YeuCauDoiCa WHERE maNhanSuGui = @0) AS soYeuCau,
        (SELECT COUNT(*) FROM SuCo WHERE maNhanSuBaoCao = @0) AS soSuCo
      `,
      [id],
    );

    const lienQuan = result[0];

    if (
      lienQuan.soTaiKhoan > 0 ||
      lienQuan.soPhanCong > 0 ||
      lienQuan.soYeuCau > 0 ||
      lienQuan.soSuCo > 0
    ) {
      throw new ConflictException(
        'Không thể xóa nhân sự vì đã có dữ liệu nghiệp vụ liên quan',
      );
    }

    try {
      await this.nhanSuRepository.remove(nhanSu);
    } catch (error) {
      const maLoi =
        typeof error === 'object' &&
        error !== null &&
        'driverError' in error
          ? (error.driverError as { number?: number })?.number
          : undefined;

      if (maLoi === 547) {
        throw new ConflictException(
          'Không thể xóa nhân sự vì đang được dữ liệu khác tham chiếu',
        );
      }

      throw error;
    }

    return {
      message: 'Xóa nhân sự thành công',
      maNhanSu: id,
    };
  }
}
