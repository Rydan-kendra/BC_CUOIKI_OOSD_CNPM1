import { Injectable, UnauthorizedException } from '@nestjs/common';
import { decodeJwt } from 'jose';
import { DataSource } from 'typeorm';
import type { TongQuanRequest } from './tong-quan.controller.js';

type TaiKhoan = {
  maNhanSu: string;
  hoTen: string;
  nhomQuyen: 'NhanVien' | 'QuanLy';
};

type ThongKeRow = {
  caHomNay: number;
  caDaPhanCong: number;
  nhanSuHomNay: number;
  yeuCauChoDuyet: number;
  suCoChuaXuLy: number;
  checklistDaHoanTat: number;
  bienBanChoTiepNhan: number;
};

@Injectable()
export class TongQuanService {
  constructor(private readonly dataSource: DataSource) {}

  private async taiKhoan(request: TongQuanRequest): Promise<TaiKhoan> {
    const authorization = request.headers.authorization ?? '';
    if (!authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bạn cần đăng nhập để xem tổng quan');
    }

    let sub: string | undefined;
    try {
      sub = decodeJwt(authorization.slice(7)).sub;
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }

    if (!sub) {
      throw new UnauthorizedException('Token không có thông tin tài khoản');
    }

    const rows: TaiKhoan[] = await this.dataSource.query(
      `SELECT TOP (1) tk.maNhanSu, ns.hoTen, tk.nhomQuyen
       FROM TaiKhoan tk
       JOIN NhanSu ns ON ns.maNhanSu = tk.maNhanSu
       WHERE tk.oidcSubject = @0 AND tk.trangThai = 'HoatDong'`,
      [sub],
    );

    if (!rows.length) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã vô hiệu hóa');
    }
    return rows[0];
  }

  async layDuLieu(request: TongQuanRequest) {
    const user = await this.taiKhoan(request);
    const laQuanLy = user.nhomQuyen === 'QuanLy';
    const params = [user.maNhanSu];
    const phamViCa = laQuanLy
      ? '1 = 1'
      : `EXISTS (SELECT 1 FROM PhanCongCa pnv
                  WHERE pnv.maCa = ca.maCa AND pnv.maNhanSu = @0)`;
    const phamViSuCo = laQuanLy
      ? '1 = 1'
      : `EXISTS (SELECT 1 FROM PhanCongCa ps
                  WHERE ps.maCa = sc.maCa AND ps.maNhanSu = @0)`;
    const phamViYeuCau = laQuanLy ? '1 = 1' : 'yc.maNhanSuGui = @0';
    const phamViBienBan = laQuanLy
      ? '1 = 1'
      : `EXISTS (SELECT 1 FROM PhanCongCa pb
                  WHERE pb.maPhanCong = bb.maPhanCongNhan AND pb.maNhanSu = @0)`;
    const phamViKiemTra = laQuanLy ? '1 = 1' : 'pk.maNhanSu = @0';

    const dongHo: Array<{ ngay: string; gio: string }> = await this.dataSource.query(
      `SELECT CONVERT(VARCHAR(10),SYSDATETIME(),23) AS ngay,
              CONVERT(VARCHAR(5),SYSDATETIME(),108) AS gio`,
    );

    const thongKeRows: ThongKeRow[] = await this.dataSource.query(
      `SELECT
        (SELECT COUNT(*) FROM CaLamViec ca
          WHERE ca.ngayLam = CAST(SYSDATETIME() AS DATE) AND ${phamViCa}) AS caHomNay,
        (SELECT COUNT(*) FROM CaLamViec ca
          WHERE ca.ngayLam = CAST(SYSDATETIME() AS DATE) AND ${phamViCa}
            AND (SELECT COUNT(*) FROM PhanCongCa pc WHERE pc.maCa = ca.maCa) = 4) AS caDaPhanCong,
        (SELECT COUNT(DISTINCT pc.maNhanSu)
          FROM PhanCongCa pc JOIN CaLamViec ca ON ca.maCa = pc.maCa
          WHERE ca.ngayLam = CAST(SYSDATETIME() AS DATE)
            AND ${laQuanLy ? '1 = 1' : 'pc.maNhanSu = @0'}) AS nhanSuHomNay,
        (SELECT COUNT(*) FROM YeuCauDoiCa yc
          WHERE yc.trangThai = 'ChoXetDuyet' AND ${phamViYeuCau}) AS yeuCauChoDuyet,
        (SELECT COUNT(*) FROM SuCo sc
          WHERE sc.trangThai <> 'DaXuLy' AND ${phamViSuCo}) AS suCoChuaXuLy,
        (SELECT COUNT(*) FROM LanKiemTra lk
          JOIN PhanCongCa pk ON pk.maPhanCong = lk.maPhanCong
          WHERE lk.trangThai = 'DaHoanTat'
            AND CAST(lk.thoiGianHoanTat AS DATE) = CAST(SYSDATETIME() AS DATE)
            AND ${phamViKiemTra}) AS checklistDaHoanTat,
        (SELECT COUNT(*) FROM BienBanBanGiaoCa bb
          WHERE bb.trangThai = 'ChoTiepNhan' AND ${phamViBienBan}) AS bienBanChoTiepNhan`,
      params,
    );

    const caHomNay = await this.dataSource.query(
      `SELECT TOP (10)
        ca.maCa, CONVERT(VARCHAR(10), ca.ngayLam, 23) AS ngayLam,
        CONVERT(VARCHAR(5), ca.gioBatDau,108) AS gioBatDau,
        CONVERT(VARCHAR(5), ca.gioKetThuc,108) AS gioKetThuc,
        ca.trangThai,
        (SELECT COUNT(*) FROM PhanCongCa p WHERE p.maCa=ca.maCa) AS soNhanVien,
        (SELECT TOP (1) ns.hoTen FROM PhanCongCa p
          JOIN NhanSu ns ON ns.maNhanSu=p.maNhanSu
          WHERE p.maCa=ca.maCa AND p.viTri=N'Trưởng ca') AS truongCa,
        ${laQuanLy ? `CAST(NULL AS NVARCHAR(40))` : `(SELECT TOP (1) p.viTri FROM PhanCongCa p WHERE p.maCa=ca.maCa AND p.maNhanSu=@0)`} AS viTriCuaToi,
        CASE WHEN SYSDATETIME() >= DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS TIME),ca.gioBatDau),CAST(ca.ngayLam AS DATETIME2))
                  AND SYSDATETIME() < DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS TIME),ca.gioKetThuc),CAST(ca.ngayLam AS DATETIME2))
             THEN 1 ELSE 0 END AS dangDienRa
       FROM CaLamViec ca
       WHERE ca.ngayLam = CAST(SYSDATETIME() AS DATE) AND ${phamViCa}
       ORDER BY ca.gioBatDau ASC, ca.maCa ASC`,
      params,
    );

    const caSapToi = await this.dataSource.query(
      `SELECT TOP (5)
        ca.maCa, CONVERT(VARCHAR(10),ca.ngayLam,23) AS ngayLam,
        CONVERT(VARCHAR(5),ca.gioBatDau,108) AS gioBatDau,
        CONVERT(VARCHAR(5),ca.gioKetThuc,108) AS gioKetThuc,
        ca.trangThai,
        ${laQuanLy ? 'CAST(NULL AS NVARCHAR(40))' : `(SELECT TOP (1) p.viTri FROM PhanCongCa p WHERE p.maCa=ca.maCa AND p.maNhanSu=@0)`} AS viTriCuaToi
       FROM CaLamViec ca
       WHERE ${phamViCa}
         AND DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS TIME),ca.gioBatDau),CAST(ca.ngayLam AS DATETIME2)) > SYSDATETIME()
       ORDER BY ca.ngayLam ASC,ca.gioBatDau ASC,ca.maCa ASC`,
      params,
    );

    const suCoCanChuY = await this.dataSource.query(
      `SELECT TOP (6) sc.maSuCo,sc.maCa,
        LEFT(sc.noiDung,240) AS noiDung,sc.mucDo,sc.trangThai,
        sc.canBanGiaoCaSau,
        CONVERT(VARCHAR(10),ca.ngayLam,23) AS ngayLam
       FROM SuCo sc
       JOIN CaLamViec ca ON ca.maCa=sc.maCa
       WHERE sc.trangThai <> 'DaXuLy' AND ${phamViSuCo}
       ORDER BY CASE WHEN sc.mucDo='QuanTrong' THEN 0 ELSE 1 END,
                ca.ngayLam DESC,sc.maSuCo DESC`,
      params,
    );

    const yeuCauGanDay = await this.dataSource.query(
      `SELECT TOP (5) yc.maYeuCau,yc.trangThai,
        ns.hoTen AS nguoiGui,ca.maCa,
        CONVERT(VARCHAR(10),ca.ngayLam,23) AS ngayLam,
        CONVERT(VARCHAR(19),yc.thoiGianGui,120) AS thoiGianGui
       FROM YeuCauDoiCa yc
       JOIN NhanSu ns ON ns.maNhanSu=yc.maNhanSuGui
       JOIN PhanCongCa pc ON pc.maPhanCong=yc.maPhanCongGoc
       JOIN CaLamViec ca ON ca.maCa=pc.maCa
       WHERE ${phamViYeuCau}
       ORDER BY yc.thoiGianGui DESC,yc.maYeuCau DESC`,
      params,
    );

    const t = thongKeRows[0] ?? {} as ThongKeRow;
    return {
      vaiTro: user.nhomQuyen,
      hoTen: user.hoTen,
      maNhanSu: user.maNhanSu,
      ngayHienTai: dongHo[0]?.ngay ?? '',
      gioHienTai: dongHo[0]?.gio ?? '',
      thongKe: {
        caHomNay: Number(t.caHomNay ?? 0),
        caDaPhanCong: Number(t.caDaPhanCong ?? 0),
        nhanSuHomNay: Number(t.nhanSuHomNay ?? 0),
        yeuCauChoDuyet: Number(t.yeuCauChoDuyet ?? 0),
        suCoChuaXuLy: Number(t.suCoChuaXuLy ?? 0),
        checklistDaHoanTat: Number(t.checklistDaHoanTat ?? 0),
        bienBanChoTiepNhan: Number(t.bienBanChoTiepNhan ?? 0),
      },
      caHomNay,
      caSapToi,
      suCoCanChuY,
      yeuCauGanDay,
    };
  }
}
