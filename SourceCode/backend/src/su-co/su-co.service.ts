import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { decodeJwt } from 'jose';
import { DataSource, QueryRunner } from 'typeorm';
import { GhiNhanSuCoDto } from './dto/ghi-nhan-su-co.dto.js';
import { CapNhatSuCoDto } from './dto/cap-nhat-su-co.dto.js';
import type { SuCoRequest } from './su-co.controller.js';

type TaiKhoan = { maTaiKhoan: string; maNhanSu: string; nhomQuyen: 'QuanLy' | 'NhanVien' };
type CaPhanCong = { maCa: string; ngayLam: string; gioBatDau: string; gioKetThuc: string; viTri: string; coTheGhiNhan: number };
type SuCo = {
  maSuCo: string;
  maCa: string;
  tenNguoiBaoCao: string;
  maNhanSuBaoCao: string;
  noiDung: string;
  mucDo: string;
  trangThai: string;
  canBanGiaoCaSau: boolean | number;
  viTriPhatSinh: string | null;
  thoiGianPhatSinh: string | null;
  bienPhapBanDau: string | null;
  thoiGianGhiNhan: string | null;
  coTheCapNhat: number;
};

@Injectable()
export class SuCoService {
  constructor(private readonly dataSource: DataSource) {}

  private async layTaiKhoan(request: SuCoRequest): Promise<TaiKhoan> {
    const header = request.headers.authorization ?? '';
    if (!header.startsWith('Bearer ')) throw new UnauthorizedException('Bạn cần đăng nhập');

    let sub: string | undefined;
    try {
      sub = decodeJwt(header.slice(7)).sub;
    } catch {
      throw new UnauthorizedException('Token không hợp lệ');
    }
    if (!sub) throw new UnauthorizedException('Token thiếu thông tin người dùng');

    const rows: TaiKhoan[] = await this.dataSource.query(
      `SELECT TOP (1) maTaiKhoan, maNhanSu, nhomQuyen
       FROM TaiKhoan WHERE oidcSubject = @0 AND trangThai = 'HoatDong'`,
      [sub],
    );
    if (!rows.length) throw new UnauthorizedException('Tài khoản không còn hoạt động');
    return rows[0];
  }

  private async layCa(maNhanSu: string, runner?: QueryRunner): Promise<CaPhanCong[]> {
    return (runner ?? this.dataSource).query(
      `SELECT pc.maCa, pc.viTri,
        CONVERT(VARCHAR(10), ca.ngayLam, 23) AS ngayLam,
        CONVERT(VARCHAR(8), ca.gioBatDau, 108) AS gioBatDau,
        CONVERT(VARCHAR(8), ca.gioKetThuc, 108) AS gioKetThuc,
        CASE WHEN ca.trangThai IN ('DaPhanCong','DangDienRa','ChoBanGiao')
          AND SYSDATETIME() >= DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00:00' AS TIME),ca.gioBatDau),CAST(ca.ngayLam AS DATETIME2))
          AND SYSDATETIME() < DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00:00' AS TIME),ca.gioKetThuc),CAST(ca.ngayLam AS DATETIME2))
        THEN 1 ELSE 0 END AS coTheGhiNhan
       FROM PhanCongCa AS pc
       INNER JOIN CaLamViec AS ca ON ca.maCa = pc.maCa
       WHERE pc.maNhanSu = @0
         AND ca.ngayLam BETWEEN DATEADD(DAY, -7, CAST(SYSDATETIME() AS DATE))
                            AND DATEADD(DAY, 30, CAST(SYSDATETIME() AS DATE))
       ORDER BY ca.ngayLam DESC, ca.gioBatDau DESC`,
      [maNhanSu],
    );
  }

  private async laySuCoTrongPhamVi(taiKhoan: TaiKhoan, maSuCo?: string, runner?: QueryRunner): Promise<SuCo[]> {
    const sql = `SELECT ${maSuCo ? 'TOP (1)' : 'TOP (150)'}
      sc.maSuCo, sc.maCa, sc.maNhanSuBaoCao, ns.hoTen AS tenNguoiBaoCao,
      sc.noiDung, sc.mucDo, sc.trangThai, sc.canBanGiaoCaSau,
      sc.viTriPhatSinh,
      CONVERT(VARCHAR(16),sc.thoiGianPhatSinh,120) AS thoiGianPhatSinh,
      sc.bienPhapBanDau,
      CONVERT(VARCHAR(19),sc.thoiGianGhiNhan,120) AS thoiGianGhiNhan,
      CONVERT(VARCHAR(10),ca.ngayLam,23) AS ngayLam,
      CONVERT(VARCHAR(8),ca.gioBatDau,108) AS gioBatDau,
      CONVERT(VARCHAR(8),ca.gioKetThuc,108) AS gioKetThuc,
      CASE WHEN @0 = 'QuanLy' OR EXISTS (
        SELECT 1 FROM PhanCongCa AS pc
        WHERE pc.maCa = sc.maCa AND pc.maNhanSu = @1 AND pc.viTri = N'Trưởng ca'
      ) THEN 1 ELSE 0 END AS coTheCapNhat
    FROM SuCo AS sc
    INNER JOIN CaLamViec AS ca ON ca.maCa = sc.maCa
    INNER JOIN NhanSu AS ns ON ns.maNhanSu = sc.maNhanSuBaoCao
    WHERE (@0 = 'QuanLy' OR EXISTS (
      SELECT 1 FROM PhanCongCa AS pc
      WHERE pc.maCa = sc.maCa AND pc.maNhanSu = @1
    ))
    ${maSuCo ? 'AND sc.maSuCo = @2' : ''}
    ORDER BY COALESCE(sc.thoiGianGhiNhan,sc.thoiGianPhatSinh,
      DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS TIME),ca.gioBatDau),CAST(ca.ngayLam AS DATETIME2))) DESC,
      sc.maSuCo DESC`;
    return (runner ?? this.dataSource).query(sql, maSuCo
      ? [taiKhoan.nhomQuyen, taiKhoan.maNhanSu, maSuCo]
      : [taiKhoan.nhomQuyen, taiKhoan.maNhanSu]);
  }

  async layDuLieu(request: SuCoRequest) {
    const taiKhoan = await this.layTaiKhoan(request);
    const [caCuaToi, danhSach] = await Promise.all([
      this.layCa(taiKhoan.maNhanSu),
      this.laySuCoTrongPhamVi(taiKhoan),
    ]);
    return { taiKhoan: { nhomQuyen: taiKhoan.nhomQuyen }, caCuaToi, danhSach };
  }

  async chiTiet(request: SuCoRequest, maSuCo: string) {
    const taiKhoan = await this.layTaiKhoan(request);
    if (!maSuCo || maSuCo.length > 20) throw new BadRequestException('Mã sự cố không hợp lệ');
    const suCo = (await this.laySuCoTrongPhamVi(taiKhoan, maSuCo))[0];
    if (!suCo) throw new NotFoundException('Không có sự cố hoặc bạn không có quyền xem');

    const lichSu = await this.dataSource.query(
      `SELECT ls.maCapNhat, ls.noiDungXuLy, ls.trangThaiSau,
        CONVERT(VARCHAR(19),ls.thoiGianCapNhat,120) AS thoiGianCapNhat,
        tk.tenDangNhap AS nguoiCapNhat
       FROM LichSuXuLySuCo AS ls
       INNER JOIN TaiKhoan AS tk ON tk.maTaiKhoan = ls.maTaiKhoanCapNhat
       WHERE ls.maSuCo = @0
       ORDER BY ls.thoiGianCapNhat DESC, ls.maCapNhat DESC`,
      [maSuCo],
    );
    return { suCo, lichSu };
  }

  async ghiNhan(request: SuCoRequest, dto: GhiNhanSuCoDto) {
    const taiKhoan = await this.layTaiKhoan(request);
    const noiDung = dto.noiDung.trim();
    const bienPhap = dto.bienPhapBanDau?.trim() ?? '';
    const thoiGianSql = `${dto.thoiGianPhatSinh}:00`;
    if (noiDung.length < 5) throw new BadRequestException('Nội dung sự cố cần ít nhất 5 ký tự');
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      await runner.startTransaction();
      const caCuaToi = await this.layCa(taiKhoan.maNhanSu, runner);
      const ca = caCuaToi.find((item) => item.maCa === dto.maCa);
      if (!ca) throw new ForbiddenException('Bạn không được phân công vào ca này');
      if (Number(ca.coTheGhiNhan) !== 1) {
        throw new ConflictException('Chỉ ghi nhận sự cố trong giờ ca đang diễn ra');
      }
      const ngaySuCo: Array<{ thoiGianPhatSinh: string | null; hopLe: number }> = await runner.query(
        `SELECT CONVERT(VARCHAR(19),TRY_CONVERT(DATETIME2,@0,126),120) AS thoiGianPhatSinh,
          CASE WHEN TRY_CONVERT(DATETIME2,@0,126) IS NOT NULL
          AND TRY_CONVERT(DATETIME2,@0,126) >= DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS TIME),ca.gioBatDau),CAST(ca.ngayLam AS DATETIME2))
          AND TRY_CONVERT(DATETIME2,@0,126) <= SYSDATETIME()
          AND TRY_CONVERT(DATETIME2,@0,126) < DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS TIME),ca.gioKetThuc),CAST(ca.ngayLam AS DATETIME2))
          THEN 1 ELSE 0 END AS hopLe
         FROM CaLamViec AS ca WHERE ca.maCa = @1`,
        [thoiGianSql, dto.maCa],
      );
      if (Number(ngaySuCo[0]?.hopLe) !== 1) {
        throw new BadRequestException('Thời gian phát sinh phải nằm trong ca đang diễn ra và không được ở tương lai');
      }
      const maSuCo = `SC${randomUUID().replace(/-/g, '').slice(0, 18)}`;
      const maCapNhat = `LS${randomUUID().replace(/-/g, '').slice(0, 18)}`;
      await runner.query(
        `INSERT INTO SuCo (
          maSuCo, maCa, maNhanSuBaoCao, noiDung, mucDo, trangThai,
          canBanGiaoCaSau, viTriPhatSinh, thoiGianPhatSinh, bienPhapBanDau, thoiGianGhiNhan
        ) VALUES (
          @0, @1, @2, @3, @4, 'ChuaHoanThanh', @5, @6, TRY_CONVERT(DATETIME2,@7,126), @8, SYSDATETIME()
        )`,
        [maSuCo, dto.maCa, taiKhoan.maNhanSu, noiDung, dto.mucDo,
          dto.canBanGiaoCaSau ? 1 : 0, dto.viTriPhatSinh, thoiGianSql, bienPhap || null],
      );
      await runner.query(
        `INSERT INTO LichSuXuLySuCo (
          maCapNhat, maSuCo, maTaiKhoanCapNhat, noiDungXuLy, trangThaiSau, thoiGianCapNhat
        ) VALUES (@0,@1,@2,@3,'ChuaHoanThanh',SYSDATETIME())`,
        [maCapNhat, maSuCo, taiKhoan.maTaiKhoan,
          bienPhap ? `Ghi nhận sự cố. Biện pháp ban đầu: ${bienPhap}` : 'Ghi nhận sự cố, chưa có biện pháp xử lý ban đầu.'],
      );
      await runner.commitTransaction();
      return { maSuCo, trangThai: 'ChuaHoanThanh', thongBao: 'Đã ghi nhận sự cố' };
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async capNhat(request: SuCoRequest, dto: CapNhatSuCoDto) {
    const taiKhoan = await this.layTaiKhoan(request);
    const noiDungXuLy = dto.noiDungXuLy.trim();
    if (noiDungXuLy.length < 5) throw new BadRequestException('Nội dung cập nhật cần ít nhất 5 ký tự');
    if (dto.trangThaiSau === 'DaXuLy' && dto.canBanGiaoCaSau) {
      throw new BadRequestException('Sự cố đã xử lý không cần bàn giao cho ca sau');
    }
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      await runner.startTransaction();
      const suCo = (await runner.query(
        `SELECT sc.maSuCo, sc.maCa, sc.trangThai
         FROM SuCo AS sc WITH (UPDLOCK,HOLDLOCK)
         WHERE sc.maSuCo = @0`,
        [dto.maSuCo],
      ))[0] as { maSuCo: string; maCa: string; trangThai: string } | undefined;
      if (!suCo) throw new NotFoundException('Không tìm thấy sự cố');
      const duocCapNhat = taiKhoan.nhomQuyen === 'QuanLy' || (await runner.query(
        `SELECT TOP (1) pc.maPhanCong FROM PhanCongCa AS pc
         WHERE pc.maCa = @0 AND pc.maNhanSu = @1 AND pc.viTri = N'Trưởng ca'`,
        [suCo.maCa, taiKhoan.maNhanSu],
      )).length > 0;
      if (!duocCapNhat) throw new ForbiddenException('Chỉ Trưởng ca phụ trách hoặc Quản lý được cập nhật');
      if (suCo.trangThai === 'DaXuLy') throw new ConflictException('Sự cố đã xử lý, không thể chỉnh sửa lịch sử');
      const maCapNhat = `LS${randomUUID().replace(/-/g, '').slice(0, 18)}`;
      await runner.query(
        `UPDATE SuCo SET trangThai = @0, canBanGiaoCaSau = @1 WHERE maSuCo = @2`,
        [dto.trangThaiSau, dto.canBanGiaoCaSau ? 1 : 0, dto.maSuCo],
      );
      await runner.query(
        `INSERT INTO LichSuXuLySuCo (
          maCapNhat, maSuCo, maTaiKhoanCapNhat, noiDungXuLy, trangThaiSau, thoiGianCapNhat
        ) VALUES (@0,@1,@2,@3,@4,SYSDATETIME())`,
        [maCapNhat, dto.maSuCo, taiKhoan.maTaiKhoan, noiDungXuLy, dto.trangThaiSau],
      );
      await runner.commitTransaction();
      return { thongBao: 'Đã cập nhật tình trạng sự cố', trangThai: dto.trangThaiSau };
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}
