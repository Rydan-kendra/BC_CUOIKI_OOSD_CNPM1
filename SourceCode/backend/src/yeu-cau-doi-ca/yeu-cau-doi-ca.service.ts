import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { decodeJwt } from 'jose';
import { DataSource } from 'typeorm';
import { GuiYeuCauDto } from './dto/gui-yeu-cau.dto.js';
import type { YeuCauRequest } from './yeu-cau-doi-ca.controller.js';

type TaiKhoan = {
  maNhanSu: string;
  nhomQuyen: string;
};

type PhanCongGoc = {
  maPhanCong: string;
  maCa: string;
  maNhanSu: string;
  trangThai: string;
  ngayLam: string;
};

@Injectable()
export class YeuCauDoiCaService {
  constructor(private readonly dataSource: DataSource) {}

  private async layNhanSuDangNhap(request: YeuCauRequest): Promise<string> {
    const authorization = request.headers.authorization ?? '';
    if (!authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bạn cần đăng nhập');
    }

    let sub: string | undefined;
    try {
      sub = decodeJwt(authorization.slice(7)).sub;
    } catch {
      throw new UnauthorizedException('Token không hợp lệ');
    }

    if (!sub) {
      throw new UnauthorizedException('Token không có mã người dùng');
    }

    const danhSach: TaiKhoan[] = await this.dataSource.query(
      `
      SELECT TOP (1) maNhanSu, nhomQuyen
      FROM TaiKhoan
      WHERE oidcSubject = @0 AND trangThai = 'HoatDong'
      `,
      [sub],
    );

    const taiKhoan = danhSach[0];
    if (!taiKhoan) {
      throw new UnauthorizedException('Không tìm thấy tài khoản hoạt động');
    }
    if (taiKhoan.nhomQuyen !== 'NhanVien') {
      throw new ForbiddenException('Chức năng gửi yêu cầu dành cho nhân viên');
    }

    return taiKhoan.maNhanSu;
  }

  async layDuLieu(request: YeuCauRequest) {
    const maNhanSu = await this.layNhanSuDangNhap(request);

    const caCuaToi = await this.dataSource.query(
      `
      SELECT
        pc.maPhanCong AS maPhanCongGoc,
        pc.maCa,
        pc.viTri,
        CONVERT(VARCHAR(10), cv.ngayLam, 23) AS ngayLam,
        CONVERT(VARCHAR(8), cv.gioBatDau, 108) AS gioBatDau,
        CONVERT(VARCHAR(8), cv.gioKetThuc, 108) AS gioKetThuc
      FROM PhanCongCa AS pc
      INNER JOIN CaLamViec AS cv ON cv.maCa = pc.maCa
      WHERE pc.maNhanSu = @0
        AND cv.ngayLam >= CONVERT(DATE, SYSDATETIME())
        AND cv.trangThai = 'DaPhanCong'
      ORDER BY cv.ngayLam, cv.gioBatDau
      `,
      [maNhanSu],
    );

    const caDeXuat = await this.dataSource.query(
      `
      SELECT
        maCa,
        CONVERT(VARCHAR(10), ngayLam, 23) AS ngayLam,
        CONVERT(VARCHAR(8), gioBatDau, 108) AS gioBatDau,
        CONVERT(VARCHAR(8), gioKetThuc, 108) AS gioKetThuc,
        trangThai
      FROM CaLamViec
      WHERE ngayLam >= CONVERT(DATE, SYSDATETIME())
        AND trangThai IN ('ChuaPhanCong', 'DaPhanCong')
      ORDER BY ngayLam, gioBatDau
      `,
    );

    const yeuCauCuaToi = await this.dataSource.query(
      `
      SELECT
        yc.maYeuCau,
        yc.maPhanCongGoc,
        yc.maCaDeXuat,
        yc.lyDo,
        yc.lyDoTuChoi,
        yc.trangThai,
        CONVERT(VARCHAR(19), yc.thoiGianGui, 120) AS thoiGianGui,
        CONVERT(VARCHAR(19), yc.thoiGianXuLy, 120) AS thoiGianXuLy,
        pc.maCa AS maCaGoc,
        CONVERT(VARCHAR(10), cg.ngayLam, 23) AS ngayCaGoc,
        CONVERT(VARCHAR(8), cg.gioBatDau, 108) AS gioCaGoc,
        CONVERT(VARCHAR(10), cd.ngayLam, 23) AS ngayCaDeXuat,
        CONVERT(VARCHAR(8), cd.gioBatDau, 108) AS gioCaDeXuat
      FROM YeuCauDoiCa AS yc
      INNER JOIN PhanCongCa AS pc ON pc.maPhanCong = yc.maPhanCongGoc
      INNER JOIN CaLamViec AS cg ON cg.maCa = pc.maCa
      INNER JOIN CaLamViec AS cd ON cd.maCa = yc.maCaDeXuat
      WHERE yc.maNhanSuGui = @0
      ORDER BY yc.thoiGianGui DESC
      `,
      [maNhanSu],
    );

    return { caCuaToi, caDeXuat, yeuCauCuaToi };
  }

  async guiYeuCau(request: YeuCauRequest, dto: GuiYeuCauDto) {
    const maNhanSu = await this.layNhanSuDangNhap(request);
    const lyDo = dto.lyDo?.trim() ?? '';
    if (lyDo.length < 5 || lyDo.length > 500) {
      throw new BadRequestException('Lý do phải có từ 5 đến 500 ký tự');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      const ketQuaKhoa: Array<{ ketQua: number }> = await queryRunner.query(`
        DECLARE @ketQua INT;
        EXEC @ketQua = sys.sp_getapplock
          @Resource = N'QuanLyCaTruc_PhanCongCa',
          @LockMode = 'Exclusive',
          @LockOwner = 'Transaction',
          @LockTimeout = 5000;
        SELECT @ketQua AS ketQua;
      `);

      if (!ketQuaKhoa[0] || Number(ketQuaKhoa[0].ketQua) < 0) {
        throw new ConflictException('Hệ thống đang xử lý lịch ca. Vui lòng thử lại');
      }

      const phanCong: PhanCongGoc[] = await queryRunner.query(
        `
        SELECT
          pc.maPhanCong,
          pc.maCa,
          pc.maNhanSu,
          cv.trangThai,
          CONVERT(VARCHAR(10), cv.ngayLam, 23) AS ngayLam
        FROM PhanCongCa AS pc WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN CaLamViec AS cv ON cv.maCa = pc.maCa
        WHERE pc.maPhanCong = @0 AND pc.maNhanSu = @1
          AND cv.ngayLam >= CONVERT(DATE, SYSDATETIME())
        `,
        [dto.maPhanCongGoc, maNhanSu],
      );

      const caGoc = phanCong[0];
      if (!caGoc || caGoc.trangThai !== 'DaPhanCong') {
        throw new BadRequestException('Ca gốc không còn thuộc lịch phân công hợp lệ của bạn');
      }

      const thongTinCaDeXuat: Array<{ maCa: string }> = await queryRunner.query(
        `
        SELECT maCa
        FROM CaLamViec
        WHERE maCa = @0
          AND ngayLam >= CONVERT(DATE, SYSDATETIME())
          AND trangThai IN ('ChuaPhanCong', 'DaPhanCong')
        `,
        [dto.maCaDeXuat],
      );

      if (!thongTinCaDeXuat.length || dto.maCaDeXuat === caGoc.maCa) {
        throw new BadRequestException('Ca đề xuất không hợp lệ hoặc trùng ca hiện tại');
      }

      const trungYeuCau: Array<{ soLuong: number }> = await queryRunner.query(
        `
        SELECT COUNT(*) AS soLuong
        FROM YeuCauDoiCa
        WHERE maNhanSuGui = @0
          AND maPhanCongGoc = @1
          AND trangThai = 'ChoXetDuyet'
        `,
        [maNhanSu, dto.maPhanCongGoc],
      );

      if (Number(trungYeuCau[0]?.soLuong ?? 0) > 0) {
        throw new ConflictException('Bạn đã có yêu cầu đang chờ xét duyệt cho ca này');
      }

      const maYeuCau = `YC${randomUUID().replace(/-/g, '').slice(0, 18)}`;

      await queryRunner.query(
        `
        INSERT INTO YeuCauDoiCa (
          maYeuCau,
          maNhanSuGui,
          maPhanCongGoc,
          maCaDeXuat,
          maTaiKhoanDuyet,
          lyDo,
          trangThai,
          thoiGianGui,
          thoiGianXuLy
        ) VALUES (
          @0, @1, @2, @3, NULL, @4, 'ChoXetDuyet', SYSDATETIME(), NULL
        )
        `,
        [maYeuCau, maNhanSu, dto.maPhanCongGoc, dto.maCaDeXuat, lyDo],
      );

      await queryRunner.commitTransaction();

      return {
        thongBao: 'Đã gửi yêu cầu đổi ca. Lịch làm việc hiện tại vẫn giữ nguyên.',
        maYeuCau,
        trangThai: 'ChoXetDuyet',
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
