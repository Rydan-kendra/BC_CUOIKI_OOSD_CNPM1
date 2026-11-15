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
import { DataSource } from 'typeorm';
import { HoanTatChecklistDto } from './dto/hoan-tat-checklist.dto.js';

type ChecklistRequest = { headers: { authorization?: string } };
type TaiKhoan = { maNhanSu: string; nhomQuyen: string };
type PhanCong = {
  maPhanCong: string;
  maNhanSu: string;
  viTri: string;
  trangThai: string;
  coTheThucHien: number;
};
type DanhSach = { maDanhSach: string; viTri: string; tenDanhSach: string };
type NoiDung = { maNoiDung: string; maDanhSach: string; noiDung: string; thuTu: number };

@Injectable()
export class ChecklistService {
  constructor(private readonly dataSource: DataSource) {}

  private async layNhanSu(request: ChecklistRequest): Promise<string> {
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
    if (!sub) throw new UnauthorizedException('Token thiếu mã định danh');

    const taiKhoan: TaiKhoan[] = await this.dataSource.query(
      `
      SELECT TOP (1) maNhanSu, nhomQuyen
      FROM TaiKhoan
      WHERE oidcSubject = @0 AND trangThai = 'HoatDong'
      `,
      [sub],
    );
    if (!taiKhoan.length) {
      throw new UnauthorizedException('Không tìm thấy tài khoản đang hoạt động');
    }
    if (taiKhoan[0].nhomQuyen !== 'NhanVien') {
      throw new ForbiddenException('Danh sách kiểm tra dành cho tài khoản nhân viên');
    }
    return taiKhoan[0].maNhanSu;
  }

  async layDuLieu(request: ChecklistRequest) {
    const maNhanSu = await this.layNhanSu(request);

    const caCuaToi = await this.dataSource.query(
      `
      SELECT
        pc.maPhanCong, pc.maCa, pc.viTri,
        CONVERT(VARCHAR(10), cv.ngayLam, 23) AS ngayLam,
        CONVERT(VARCHAR(8), cv.gioBatDau, 108) AS gioBatDau,
        CONVERT(VARCHAR(8), cv.gioKetThuc, 108) AS gioKetThuc,
        cv.trangThai,
        CASE WHEN cv.trangThai IN ('DaPhanCong', 'DangDienRa', 'ChoBanGiao')
          AND DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00:00' AS TIME), cv.gioBatDau), CAST(cv.ngayLam AS DATETIME2)) <= SYSDATETIME()
          AND DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00:00' AS TIME), cv.gioKetThuc), CAST(cv.ngayLam AS DATETIME2)) >= SYSDATETIME()
          THEN 1 ELSE 0 END AS coTheThucHien
      FROM PhanCongCa AS pc
      INNER JOIN CaLamViec AS cv ON cv.maCa = pc.maCa
      WHERE pc.maNhanSu = @0
        AND pc.viTri IN (N'Pha chế', N'Thu ngân', N'Khu vực phục vụ')
        AND cv.ngayLam BETWEEN DATEADD(DAY, -7, CONVERT(DATE, SYSDATETIME()))
                            AND DATEADD(DAY, 30, CONVERT(DATE, SYSDATETIME()))
      ORDER BY cv.ngayLam DESC, cv.gioBatDau DESC
      `,
      [maNhanSu],
    );

    const danhSach: DanhSach[] = await this.dataSource.query(`
      SELECT maDanhSach, viTri, tenDanhSach
      FROM DanhSachKiemTra
      WHERE viTri IN (N'Pha chế', N'Thu ngân', N'Khu vực phục vụ')
      ORDER BY viTri, tenDanhSach
    `);

    const noiDung: NoiDung[] = await this.dataSource.query(`
      SELECT nd.maNoiDung, nd.maDanhSach, nd.noiDung, nd.thuTu
      FROM NoiDungKiemTra AS nd
      INNER JOIN DanhSachKiemTra AS ds ON ds.maDanhSach = nd.maDanhSach
      WHERE ds.viTri IN (N'Pha chế', N'Thu ngân', N'Khu vực phục vụ')
      ORDER BY nd.maDanhSach, nd.thuTu, nd.maNoiDung
    `);

    const lichSu = await this.dataSource.query(
      `
      SELECT TOP (60)
        kt.maLan, kt.maPhanCong, kt.maDanhSach, ds.tenDanhSach,
        pc.maCa, pc.viTri,
        CONVERT(VARCHAR(10), cv.ngayLam, 23) AS ngayLam,
        CONVERT(VARCHAR(19), kt.thoiGianHoanTat, 120) AS thoiGianHoanTat,
        kt.trangThai,
        SUM(CASE WHEN kq.ketQua = 'Dat' THEN 1 ELSE 0 END) AS soDat,
        SUM(CASE WHEN kq.ketQua = 'KhongDat' THEN 1 ELSE 0 END) AS soKhongDat
      FROM LanKiemTra AS kt
      INNER JOIN PhanCongCa AS pc ON pc.maPhanCong = kt.maPhanCong
      INNER JOIN CaLamViec AS cv ON cv.maCa = pc.maCa
      INNER JOIN DanhSachKiemTra AS ds ON ds.maDanhSach = kt.maDanhSach
      LEFT JOIN KetQuaKiemTra AS kq ON kq.maLan = kt.maLan
      WHERE pc.maNhanSu = @0
      GROUP BY kt.maLan, kt.maPhanCong, kt.maDanhSach, ds.tenDanhSach,
               pc.maCa, pc.viTri, cv.ngayLam, kt.thoiGianHoanTat, kt.trangThai
      ORDER BY kt.thoiGianHoanTat DESC, kt.maLan DESC
      `,
      [maNhanSu],
    );

    return { caCuaToi, danhSach, noiDung, lichSu };
  }

  async hoanTat(request: ChecklistRequest, dto: HoanTatChecklistDto) {
    const maNhanSu = await this.layNhanSu(request);
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
        throw new ConflictException('Hệ thống đang cập nhật lịch ca. Vui lòng thử lại');
      }

      const cacCa: PhanCong[] = await queryRunner.query(
        `
        SELECT pc.maPhanCong, pc.maNhanSu, pc.viTri, cv.trangThai,
          CASE WHEN cv.trangThai IN ('DaPhanCong', 'DangDienRa', 'ChoBanGiao')
            AND DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00:00' AS TIME), cv.gioBatDau), CAST(cv.ngayLam AS DATETIME2)) <= SYSDATETIME()
            AND DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00:00' AS TIME), cv.gioKetThuc), CAST(cv.ngayLam AS DATETIME2)) >= SYSDATETIME()
            THEN 1 ELSE 0 END AS coTheThucHien
        FROM PhanCongCa AS pc WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN CaLamViec AS cv ON cv.maCa = pc.maCa
        WHERE pc.maPhanCong = @0 AND pc.maNhanSu = @1
        `,
        [dto.maPhanCong, maNhanSu],
      );
      const phanCong = cacCa[0];
      if (!phanCong) {
        throw new NotFoundException('Bạn không còn được phân công vào ca này');
      }
      if (!['Pha chế', 'Thu ngân', 'Khu vực phục vụ'].includes(phanCong.viTri)) {
        throw new ForbiddenException('Chức năng kiểm tra không áp dụng cho vị trí Trưởng ca');
      }
      if (Number(phanCong.coTheThucHien) !== 1) {
        throw new ConflictException('Chỉ được hoàn tất checklist khi ca đang diễn ra');
      }

      const danhSach: DanhSach[] = await queryRunner.query(
        `
        SELECT maDanhSach, viTri, tenDanhSach
        FROM DanhSachKiemTra WITH (HOLDLOCK)
        WHERE maDanhSach = @0
        `,
        [dto.maDanhSach],
      );
      if (!danhSach.length || danhSach[0].viTri !== phanCong.viTri) {
        throw new BadRequestException('Danh sách kiểm tra không phù hợp với vị trí được phân công');
      }

      const daBanGiao: Array<{ maBanGiao: string }> = await queryRunner.query(
        `
        SELECT TOP (1) maBanGiao
        FROM BanGiaoTheoViTri
        WHERE maPhanCongGiao = @0
        `,
        [dto.maPhanCong],
      );
      if (daBanGiao.length) {
        throw new ConflictException('Vị trí này đã bàn giao, không thể tạo checklist mới');
      }

      const noiDung: NoiDung[] = await queryRunner.query(
        `
        SELECT maNoiDung, maDanhSach, noiDung, thuTu
        FROM NoiDungKiemTra WITH (HOLDLOCK)
        WHERE maDanhSach = @0
        ORDER BY thuTu, maNoiDung
        `,
        [dto.maDanhSach],
      );
      if (noiDung.length === 0) {
        throw new BadRequestException('Danh sách kiểm tra chưa có nội dung');
      }
      if (dto.ketQua.length !== noiDung.length) {
        throw new BadRequestException('Cần điền đủ kết quả cho tất cả mục kiểm tra');
      }

      const daGhi = new Set<string>();
      const maHopLe = new Set(noiDung.map((muc) => muc.maNoiDung));
      for (const muc of dto.ketQua) {
        if (!maHopLe.has(muc.maNoiDung) || daGhi.has(muc.maNoiDung)) {
          throw new BadRequestException('Có mục kiểm tra trùng hoặc không thuộc danh sách');
        }
        daGhi.add(muc.maNoiDung);
        if (muc.ketQua === 'KhongDat' && (muc.ghiChu?.trim().length ?? 0) < 3) {
          throw new BadRequestException('Mục chưa đạt cần ghi chú ít nhất 3 ký tự');
        }
      }

      const maLan = `LK${randomUUID().replace(/-/g, '').slice(0, 18)}`;
      await queryRunner.query(
        `
        INSERT INTO LanKiemTra (
          maLan, maDanhSach, maPhanCong, thoiGianHoanTat, trangThai
        ) VALUES (@0, @1, @2, SYSDATETIME(), 'DaHoanTat')
        `,
        [maLan, dto.maDanhSach, dto.maPhanCong],
      );

      for (const muc of dto.ketQua) {
        const maKetQua = `KQ${randomUUID().replace(/-/g, '').slice(0, 18)}`;
        await queryRunner.query(
          `
          INSERT INTO KetQuaKiemTra (
            maKetQua, maLan, maNoiDung, ketQua, ghiChu
          ) VALUES (@0, @1, @2, @3, @4)
          `,
          [maKetQua, maLan, muc.maNoiDung, muc.ketQua, muc.ghiChu?.trim() || null],
        );
      }

      await queryRunner.commitTransaction();
      return {
        thongBao: 'Đã hoàn tất danh sách kiểm tra và lưu tất cả kết quả',
        maLan,
        trangThai: 'DaHoanTat',
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
