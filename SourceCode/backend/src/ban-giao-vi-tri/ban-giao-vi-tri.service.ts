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
import { TiepNhanBanGiaoDto } from './dto/tiep-nhan-ban-giao.dto.js';

type BanGiaoRequest = { headers: { authorization?: string } };
type TaiKhoan = { maNhanSu: string; nhomQuyen: string };
type CaNhan = {
  maPhanCongNhan: string;
  maCaNhan: string;
  maNhanSuNhan: string;
  viTri: string;
  ngayNhan: string;
  gioBatDauNhan: string;
  gioKetThucNhan: string;
  trangThaiCaNhan: string;
  coTheTiepNhan: number;
  maCaGiao: string | null;
  ngayGiao: string | null;
  gioBatDauGiao: string | null;
  gioKetThucGiao: string | null;
  maPhanCongGiao: string | null;
  maNhanSuGiao: string | null;
  tenNguoiGiao: string | null;
  maLanKiemTra: string | null;
  tenDanhSach: string | null;
  thoiGianHoanTat: string | null;
  maBanGiao: string | null;
  trangThaiTiepNhan: string | null;
  ghiChuTiepNhan: string | null;
  thoiGianTiepNhan: string | null;
  soDat: number;
  soKhongDat: number;
};

type MucKiemTra = {
  maLan: string;
  maNoiDung: string;
  noiDung: string;
  thuTu: number;
  ketQua: string;
  ghiChu: string | null;
};

const layCacCaSql = `
  SELECT
    pcNhan.maPhanCong AS maPhanCongNhan,
    pcNhan.maCa AS maCaNhan,
    pcNhan.maNhanSu AS maNhanSuNhan,
    pcNhan.viTri,
    CONVERT(VARCHAR(10), caNhan.ngayLam, 23) AS ngayNhan,
    CONVERT(VARCHAR(8), caNhan.gioBatDau, 108) AS gioBatDauNhan,
    CONVERT(VARCHAR(8), caNhan.gioKetThuc, 108) AS gioKetThucNhan,
    caNhan.trangThai AS trangThaiCaNhan,
    CASE WHEN caNhan.trangThai IN ('DaPhanCong', 'DangDienRa', 'ChoBanGiao')
       AND thoiGianCaNhan.batDau <= SYSDATETIME()
       AND thoiGianCaNhan.ketThuc >= SYSDATETIME()
       THEN 1 ELSE 0 END AS coTheTiepNhan,
    caGiao.maCa AS maCaGiao,
    CONVERT(VARCHAR(10), caGiao.ngayLam, 23) AS ngayGiao,
    CONVERT(VARCHAR(8), caGiao.gioBatDau, 108) AS gioBatDauGiao,
    CONVERT(VARCHAR(8), caGiao.gioKetThuc, 108) AS gioKetThucGiao,
    pcGiao.maPhanCong AS maPhanCongGiao,
    pcGiao.maNhanSu AS maNhanSuGiao,
    nsGiao.hoTen AS tenNguoiGiao,
    lan.maLan AS maLanKiemTra,
    lan.tenDanhSach,
    CONVERT(VARCHAR(19), lan.thoiGianHoanTat, 120) AS thoiGianHoanTat,
    bg.maBanGiao,
    bg.trangThaiTiepNhan,
    bg.ghiChu AS ghiChuTiepNhan,
    CONVERT(VARCHAR(19), bg.thoiGianTiepNhan, 120) AS thoiGianTiepNhan,
    ISNULL(tong.soDat, 0) AS soDat,
    ISNULL(tong.soKhongDat, 0) AS soKhongDat
  FROM PhanCongCa AS pcNhan
  INNER JOIN CaLamViec AS caNhan ON caNhan.maCa = pcNhan.maCa
  CROSS APPLY (
    SELECT
      DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00:00' AS TIME), caNhan.gioBatDau), CAST(caNhan.ngayLam AS DATETIME2)) AS batDau,
      DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00:00' AS TIME), caNhan.gioKetThuc), CAST(caNhan.ngayLam AS DATETIME2)) AS ketThuc
  ) AS thoiGianCaNhan
  OUTER APPLY (
    SELECT TOP (1) cv.maCa, cv.ngayLam, cv.gioBatDau, cv.gioKetThuc
    FROM CaLamViec AS cv
    CROSS APPLY (
      SELECT DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00:00' AS TIME), cv.gioKetThuc), CAST(cv.ngayLam AS DATETIME2)) AS ketThuc
    ) AS thoiGianCaGiao
    WHERE cv.maCa <> caNhan.maCa
      AND thoiGianCaGiao.ketThuc <= thoiGianCaNhan.batDau
      AND thoiGianCaGiao.ketThuc >= DATEADD(DAY, -1, thoiGianCaNhan.batDau)
    ORDER BY thoiGianCaGiao.ketThuc DESC, cv.maCa DESC
  ) AS caGiao
  LEFT JOIN PhanCongCa AS pcGiao
    ON pcGiao.maCa = caGiao.maCa AND pcGiao.viTri = pcNhan.viTri
  LEFT JOIN NhanSu AS nsGiao ON nsGiao.maNhanSu = pcGiao.maNhanSu
  OUTER APPLY (
    SELECT TOP (1) lk.maLan, ds.tenDanhSach, lk.thoiGianHoanTat
    FROM LanKiemTra AS lk
    INNER JOIN DanhSachKiemTra AS ds ON ds.maDanhSach = lk.maDanhSach
    WHERE lk.maPhanCong = pcGiao.maPhanCong AND lk.trangThai = 'DaHoanTat'
      AND lk.thoiGianHoanTat IS NOT NULL
    ORDER BY lk.thoiGianHoanTat DESC, lk.maLan DESC
  ) AS lan
  OUTER APPLY (
    SELECT
      SUM(CASE WHEN kq.ketQua = 'Dat' THEN 1 ELSE 0 END) AS soDat,
      SUM(CASE WHEN kq.ketQua = 'KhongDat' THEN 1 ELSE 0 END) AS soKhongDat
    FROM KetQuaKiemTra AS kq
    WHERE kq.maLan = lan.maLan
  ) AS tong
  LEFT JOIN BanGiaoTheoViTri AS bg ON bg.maPhanCongNhan = pcNhan.maPhanCong
  WHERE pcNhan.maNhanSu = @0
    AND pcNhan.viTri IN (N'Pha chế', N'Thu ngân', N'Khu vực phục vụ')
    AND caNhan.ngayLam BETWEEN DATEADD(DAY, -7, CONVERT(DATE, SYSDATETIME()))
                            AND DATEADD(DAY, 30, CONVERT(DATE, SYSDATETIME()))
  ORDER BY caNhan.ngayLam DESC, caNhan.gioBatDau DESC, pcNhan.maPhanCong DESC
`;

@Injectable()
export class BanGiaoViTriService {
  constructor(private readonly dataSource: DataSource) {}

  private async layNhanSu(request: BanGiaoRequest): Promise<string> {
    const bearer = request.headers.authorization ?? '';
    if (!bearer.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bạn cần đăng nhập để tiếp nhận bàn giao');
    }

    let sub: string | undefined;
    try {
      sub = decodeJwt(bearer.slice(7)).sub;
    } catch {
      throw new UnauthorizedException('Token đăng nhập không hợp lệ');
    }
    if (!sub) throw new UnauthorizedException('Token không có mã định danh');

    const taiKhoan: TaiKhoan[] = await this.dataSource.query(
      `SELECT TOP (1) maNhanSu, nhomQuyen FROM TaiKhoan
       WHERE oidcSubject = @0 AND trangThai = 'HoatDong'`,
      [sub],
    );
    if (!taiKhoan.length) throw new UnauthorizedException('Không tìm thấy tài khoản đang hoạt động');
    if (taiKhoan[0].nhomQuyen !== 'NhanVien') {
      throw new ForbiddenException('Tiếp nhận bàn giao theo vị trí dành cho tài khoản nhân viên');
    }
    return taiKhoan[0].maNhanSu;
  }

  private async layCacCa(maNhanSu: string, runner?: QueryRunner): Promise<CaNhan[]> {
    return (runner ?? this.dataSource).query(layCacCaSql, [maNhanSu]);
  }

  async layDuLieu(request: BanGiaoRequest) {
    const maNhanSu = await this.layNhanSu(request);
    const caCuaToi = await this.layCacCa(maNhanSu);
    const cacMaLan = Array.from(new Set(
      caCuaToi.map((ca) => ca.maLanKiemTra).filter((ma): ma is string => Boolean(ma)),
    ));
    let ketQuaKiemTra: MucKiemTra[] = [];

    if (cacMaLan.length > 0) {
      const bind = cacMaLan.map((_, index) => `@${index}`).join(', ');
      ketQuaKiemTra = await this.dataSource.query(
        `SELECT kq.maLan, kq.maNoiDung, nd.noiDung, nd.thuTu, kq.ketQua, kq.ghiChu
         FROM KetQuaKiemTra AS kq
         INNER JOIN NoiDungKiemTra AS nd ON nd.maNoiDung = kq.maNoiDung
         WHERE kq.maLan IN (${bind})
         ORDER BY kq.maLan, nd.thuTu, nd.maNoiDung`,
        cacMaLan,
      );
    }

    return { caCuaToi, ketQuaKiemTra };
  }

  async tiepNhan(request: BanGiaoRequest, dto: TiepNhanBanGiaoDto) {
    const maNhanSu = await this.layNhanSu(request);
    const ghiChu = dto.ghiChu?.trim() ?? '';
    if (dto.trangThaiTiepNhan === 'CanBoSung' && ghiChu.length < 5) {
      throw new BadRequestException('Khi phát hiện thiếu sót, cần ghi chú ít nhất 5 ký tự');
    }

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      await runner.startTransaction();

      const khoa: Array<{ ketQua: number }> = await runner.query(`
        DECLARE @ketQua INT;
        EXEC @ketQua = sys.sp_getapplock
          @Resource = N'QuanLyCaTruc_PhanCongCa',
          @LockMode = 'Exclusive',
          @LockOwner = 'Transaction',
          @LockTimeout = 5000;
        SELECT @ketQua AS ketQua;
      `);
      if (!khoa[0] || Number(khoa[0].ketQua) < 0) {
        throw new ConflictException('Hệ thống đang cập nhật lịch ca. Vui lòng thử lại');
      }

      const caCuaToi = await this.layCacCa(maNhanSu, runner);
      const caNhan = caCuaToi.find((ca) => ca.maPhanCongNhan === dto.maPhanCongNhan);
      if (!caNhan) throw new NotFoundException('Không có phân công tiếp nhận phù hợp với tài khoản');
      if (Number(caNhan.coTheTiepNhan) !== 1) {
        throw new ConflictException('Chỉ được xác nhận bàn giao khi ca tiếp nhận đang diễn ra');
      }
      if (!caNhan.maCaGiao || !caNhan.maPhanCongGiao || !caNhan.maLanKiemTra) {
        throw new ConflictException('Ca trước chưa hoàn tất checklist cho vị trí tương ứng');
      }
      if (caNhan.maNhanSuNhan === caNhan.maNhanSuGiao) {
        throw new ConflictException('Không thể tự bàn giao và tiếp nhận cùng một vị trí');
      }
      if (caNhan.maLanKiemTra !== dto.maLanKiemTra) {
        throw new ConflictException('Checklist ca trước đã được cập nhật. Hãy tải lại trang');
      }
      if (dto.trangThaiTiepNhan === 'DaTiepNhan' && Number(caNhan.soKhongDat) > 0 && ghiChu.length < 5) {
        throw new BadRequestException('Checklist ca trước có mục không đạt. Hãy ghi chú cách xử lý hoặc tình trạng thực tế trước khi đồng ý tiếp nhận');
      }

      const daBanGiao: Array<{ maBanGiao: string; maPhanCongNhan: string }> = await runner.query(
        `SELECT maBanGiao, maPhanCongNhan FROM BanGiaoTheoViTri WITH (UPDLOCK, HOLDLOCK)
         WHERE maPhanCongGiao = @0`,
        [caNhan.maPhanCongGiao],
      );
      if (daBanGiao.some((bg) => bg.maPhanCongNhan !== caNhan.maPhanCongNhan)) {
        throw new ConflictException('Nhân viên ca trước đã bàn giao vị trí này cho phân công khác');
      }

      if (caNhan.maBanGiao) {
        if (caNhan.trangThaiTiepNhan === 'DaTiepNhan') {
          throw new ConflictException('Vị trí này đã được xác nhận tiếp nhận, không thể thực hiện lại');
        }
        if (caNhan.trangThaiTiepNhan !== 'CanBoSung') {
          throw new ConflictException('Trạng thái bàn giao hiện tại không cho phép cập nhật');
        }
        await runner.query(
          `UPDATE BanGiaoTheoViTri
           SET trangThaiTiepNhan = @0, ghiChu = @1,
               thoiGianTiepNhan = CASE WHEN @0 = 'DaTiepNhan' THEN SYSDATETIME() ELSE NULL END
           WHERE maBanGiao = @2 AND maPhanCongNhan = @3 AND trangThaiTiepNhan = 'CanBoSung'`,
          [dto.trangThaiTiepNhan, ghiChu || null, caNhan.maBanGiao, caNhan.maPhanCongNhan],
        );
      } else {
        const maBanGiao = `BG${randomUUID().replace(/-/g, '').slice(0, 18)}`;
        await runner.query(
          `INSERT INTO BanGiaoTheoViTri (
             maBanGiao, maPhanCongGiao, maPhanCongNhan, maLanKiemTra,
             trangThaiTiepNhan, ghiChu, thoiGianTiepNhan
           ) VALUES (
             @0, @1, @2, @3, @4, @5,
             CASE WHEN @4 = 'DaTiepNhan' THEN SYSDATETIME() ELSE NULL END
           )`,
          [maBanGiao, caNhan.maPhanCongGiao, caNhan.maPhanCongNhan,
            caNhan.maLanKiemTra, dto.trangThaiTiepNhan, ghiChu || null],
        );
      }

      await runner.commitTransaction();
      return {
        thongBao: dto.trangThaiTiepNhan === 'DaTiepNhan'
          ? 'Đã ghi nhận đồng ý tiếp nhận bàn giao theo vị trí'
          : 'Đã ghi nhận nội dung thiếu sót cần bổ sung, chưa xác nhận tiếp nhận',
        trangThaiTiepNhan: dto.trangThaiTiepNhan,
      };
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}
