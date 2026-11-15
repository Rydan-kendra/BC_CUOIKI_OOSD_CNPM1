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
import type { BanGiaoCaRequest } from './ban-giao-ca.controller.js';
import { LapBienBanDto } from './dto/lap-bien-ban.dto.js';
import { PhanHoiBienBanDto } from './dto/phan-hoi-bien-ban.dto.js';

type TaiKhoan = { maTaiKhoan: string; maNhanSu: string; nhomQuyen: 'NhanVien' | 'QuanLy' };
type CaPhuTrach = {
  maCa: string;
  maPhanCongGiao: string;
  maNhanSuGiao: string;
  ngayLam: string;
  gioBatDau: string;
  gioKetThuc: string;
  trangThaiCa: string;
  coTheLap: number;
  soNhanVien: number;
  soViTriDaKiemTra: number;
  soSuCoTonDong: number;
  maCaTiepNhan: string | null;
  maPhanCongNhan: string | null;
  maNhanSuNhan: string | null;
  tenTruongCaNhan: string | null;
  maBienBan: string | null;
  trangThai: string | null;
  tongKetVanHanh: string | null;
  noiDungTonDong: string | null;
  canBoSung: boolean | number | null;
  ghiChuYeuCauBoSung: string | null;
  thoiGianLap: string | null;
  thoiGianCapNhat: string | null;
};

type BienBanNhan = {
  maBienBan: string;
  maCaBanGiao: string;
  maCaTiepNhan: string;
  ngayBanGiao: string;
  gioBatDauBanGiao: string;
  gioKetThucBanGiao: string;
  tenTruongCaGiao: string;
  tongKetVanHanh: string;
  noiDungTonDong: string | null;
  trangThai: string;
  canBoSung: boolean | number;
  ghiChuYeuCauBoSung: string | null;
  thoiGianLap: string;
  thoiGianTiepNhan: string | null;
  coTheTiepNhan: number;
};

const sqlCaPhuTrach = `
  SELECT
    ca.maCa,
    pc.maPhanCong AS maPhanCongGiao,
    pc.maNhanSu AS maNhanSuGiao,
    CONVERT(VARCHAR(10),ca.ngayLam,23) AS ngayLam,
    CONVERT(VARCHAR(8),ca.gioBatDau,108) AS gioBatDau,
    CONVERT(VARCHAR(8),ca.gioKetThuc,108) AS gioKetThuc,
    ca.trangThai AS trangThaiCa,
    CASE WHEN SYSDATETIME() >= tg.batDau AND SYSDATETIME() < tg.ketThuc
      AND ca.trangThai IN ('DaPhanCong','DangDienRa','ChoBanGiao')
      THEN 1 ELSE 0 END AS coTheLap,
    (SELECT COUNT(*) FROM PhanCongCa p WHERE p.maCa=ca.maCa) AS soNhanVien,
    (SELECT COUNT(DISTINCT p.viTri)
      FROM PhanCongCa p
      WHERE p.maCa=ca.maCa AND p.viTri IN (N'Pha chế',N'Thu ngân',N'Khu vực phục vụ')
        AND EXISTS (SELECT 1 FROM LanKiemTra lk
          WHERE lk.maPhanCong=p.maPhanCong AND lk.trangThai='DaHoanTat')) AS soViTriDaKiemTra,
    (SELECT COUNT(*) FROM SuCo sc WHERE sc.maCa=ca.maCa
      AND (sc.trangThai <> 'DaXuLy' OR sc.canBanGiaoCaSau=1)) AS soSuCoTonDong,
    COALESCE(bb.maCaTiepNhan,caSau.maCa) AS maCaTiepNhan,
    pcNhan.maPhanCong AS maPhanCongNhan,
    pcNhan.maNhanSu AS maNhanSuNhan,
    nsNhan.hoTen AS tenTruongCaNhan,
    bb.maBienBan,bb.trangThai,bb.tongKetVanHanh,bb.noiDungTonDong,
    bb.canBoSung,bb.ghiChuYeuCauBoSung,
    CONVERT(VARCHAR(19),bb.thoiGianLap,120) AS thoiGianLap,
    CONVERT(VARCHAR(19),bb.thoiGianCapNhat,120) AS thoiGianCapNhat
  FROM PhanCongCa pc
  JOIN CaLamViec ca ON ca.maCa=pc.maCa
  CROSS APPLY (
    SELECT
      DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS TIME),ca.gioBatDau),CAST(ca.ngayLam AS DATETIME2)) AS batDau,
      DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS TIME),ca.gioKetThuc),CAST(ca.ngayLam AS DATETIME2)) AS ketThuc
  ) tg
  LEFT JOIN BienBanBanGiaoCa bb ON bb.maCaBanGiao=ca.maCa
  OUTER APPLY (
    SELECT TOP (1) cv.maCa
    FROM CaLamViec cv
    CROSS APPLY (
      SELECT DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS TIME),cv.gioBatDau),CAST(cv.ngayLam AS DATETIME2)) AS batDau
    ) tgn
    WHERE cv.maCa<>ca.maCa AND tgn.batDau>=tg.ketThuc
      AND tgn.batDau<=DATEADD(HOUR,12,tg.ketThuc)
    ORDER BY tgn.batDau ASC,cv.maCa ASC
  ) caSau
  LEFT JOIN PhanCongCa pcNhan
    ON pcNhan.maCa=COALESCE(bb.maCaTiepNhan,caSau.maCa) AND pcNhan.viTri=N'Trưởng ca'
  LEFT JOIN NhanSu nsNhan ON nsNhan.maNhanSu=pcNhan.maNhanSu
  WHERE pc.maNhanSu=@0 AND pc.viTri=N'Trưởng ca'
    AND ca.ngayLam BETWEEN DATEADD(DAY,-14,CAST(SYSDATETIME() AS DATE))
                        AND DATEADD(DAY,31,CAST(SYSDATETIME() AS DATE))
  ORDER BY ca.ngayLam DESC,ca.gioBatDau DESC
`;

@Injectable()
export class BanGiaoCaService {
  constructor(private readonly dataSource: DataSource) {}

  private async layTaiKhoan(request: BanGiaoCaRequest, runner?: QueryRunner): Promise<TaiKhoan> {
    const bearer = request.headers.authorization ?? '';
    if (!bearer.startsWith('Bearer ')) throw new UnauthorizedException('Bạn cần đăng nhập');
    let sub: string | undefined;
    try {
      sub = decodeJwt(bearer.slice(7)).sub;
    } catch {
      throw new UnauthorizedException('Token không hợp lệ');
    }
    if (!sub) throw new UnauthorizedException('Token thiếu thông tin định danh');
    const rows: TaiKhoan[] = await (runner ?? this.dataSource).query(
      `SELECT TOP(1) maTaiKhoan,maNhanSu,nhomQuyen FROM TaiKhoan
       WHERE oidcSubject=@0 AND trangThai='HoatDong'`,
      [sub],
    );
    if (!rows.length) throw new UnauthorizedException('Tài khoản không hoạt động');
    return rows[0];
  }

  private async layCa(maNhanSu: string, runner?: QueryRunner): Promise<CaPhuTrach[]> {
    return (runner ?? this.dataSource).query(sqlCaPhuTrach, [maNhanSu]);
  }

  private async layBienBanNhan(maNhanSu: string, runner?: QueryRunner): Promise<BienBanNhan[]> {
    return (runner ?? this.dataSource).query(`
      SELECT bb.maBienBan,bb.maCaBanGiao,bb.maCaTiepNhan,
        CONVERT(VARCHAR(10),caGiao.ngayLam,23) AS ngayBanGiao,
        CONVERT(VARCHAR(8),caGiao.gioBatDau,108) AS gioBatDauBanGiao,
        CONVERT(VARCHAR(8),caGiao.gioKetThuc,108) AS gioKetThucBanGiao,
        nsGiao.hoTen AS tenTruongCaGiao,
        bb.tongKetVanHanh,bb.noiDungTonDong,bb.trangThai,
        bb.canBoSung,bb.ghiChuYeuCauBoSung,
        CONVERT(VARCHAR(19),bb.thoiGianLap,120) AS thoiGianLap,
        CONVERT(VARCHAR(19),bb.thoiGianTiepNhan,120) AS thoiGianTiepNhan,
        CASE WHEN SYSDATETIME()>=tg.batDau AND SYSDATETIME()<tg.ketThuc
          AND caNhan.trangThai IN ('DaPhanCong','DangDienRa','ChoBanGiao')
          THEN 1 ELSE 0 END AS coTheTiepNhan
      FROM BienBanBanGiaoCa bb
      JOIN PhanCongCa pcNhan ON pcNhan.maPhanCong=bb.maPhanCongNhan
        AND pcNhan.maCa=bb.maCaTiepNhan AND pcNhan.viTri=N'Trưởng ca'
      JOIN PhanCongCa pcGiao ON pcGiao.maPhanCong=bb.maPhanCongGiao
      JOIN NhanSu nsGiao ON nsGiao.maNhanSu=pcGiao.maNhanSu
      JOIN CaLamViec caGiao ON caGiao.maCa=bb.maCaBanGiao
      JOIN CaLamViec caNhan ON caNhan.maCa=bb.maCaTiepNhan
      CROSS APPLY (
        SELECT
          DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS TIME),caNhan.gioBatDau),CAST(caNhan.ngayLam AS DATETIME2)) AS batDau,
          DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS TIME),caNhan.gioKetThuc),CAST(caNhan.ngayLam AS DATETIME2)) AS ketThuc
      ) tg
      WHERE pcNhan.maNhanSu=@0 AND caNhan.ngayLam >= DATEADD(DAY,-14,CAST(SYSDATETIME() AS DATE))
      ORDER BY caNhan.ngayLam DESC,caNhan.gioBatDau DESC,bb.maBienBan DESC
    `, [maNhanSu]);
  }

  async layDuLieu(request: BanGiaoCaRequest) {
    const user = await this.layTaiKhoan(request);
    const [caPhuTrach, bienBanCanNhan] = await Promise.all([
      this.layCa(user.maNhanSu),
      this.layBienBanNhan(user.maNhanSu),
    ]);
    return { caPhuTrach, bienBanCanNhan, nhomQuyen: user.nhomQuyen };
  }

  async thongTinCa(request: BanGiaoCaRequest, maCa: string) {
    const user = await this.layTaiKhoan(request);
    if (!/^[A-Za-z0-9_-]{1,20}$/.test(maCa)) {
      throw new BadRequestException('Mã ca không hợp lệ');
    }
    const quyen: Array<{ hopLe: number }> = await this.dataSource.query(`
      SELECT CASE WHEN EXISTS (
        SELECT 1 FROM PhanCongCa pc
        WHERE pc.maCa=@0 AND pc.maNhanSu=@1 AND pc.viTri=N'Trưởng ca'
      ) OR EXISTS (
        SELECT 1 FROM BienBanBanGiaoCa bb
        JOIN PhanCongCa pcNhan ON pcNhan.maPhanCong=bb.maPhanCongNhan
        WHERE bb.maCaBanGiao=@0 AND pcNhan.maNhanSu=@1 AND pcNhan.viTri=N'Trưởng ca'
      ) THEN 1 ELSE 0 END AS hopLe
    `, [maCa, user.maNhanSu]);
    if (Number(quyen[0]?.hopLe) !== 1) {
      throw new ForbiddenException('Chỉ Trưởng ca bàn giao hoặc tiếp nhận được xem nội dung này');
    }

    const [checklist, suCo] = await Promise.all([
      this.dataSource.query(`
        SELECT pc.viTri,ns.hoTen AS nguoiKiemTra,lk.maLan,
          CONVERT(VARCHAR(19),lk.thoiGianHoanTat,120) AS thoiGianHoanTat,
          ISNULL(tong.soDat,0) AS soDat,ISNULL(tong.soKhongDat,0) AS soKhongDat,
          khongDat.noiDungCanLuuY
        FROM PhanCongCa pc
        JOIN NhanSu ns ON ns.maNhanSu=pc.maNhanSu
        OUTER APPLY (
          SELECT TOP(1) maLan,thoiGianHoanTat
          FROM LanKiemTra WHERE maPhanCong=pc.maPhanCong AND trangThai='DaHoanTat'
          ORDER BY thoiGianHoanTat DESC,maLan DESC
        ) lk
        OUTER APPLY (
          SELECT SUM(CASE WHEN kq.ketQua='Dat' THEN 1 ELSE 0 END) AS soDat,
            SUM(CASE WHEN kq.ketQua='KhongDat' THEN 1 ELSE 0 END) AS soKhongDat
          FROM KetQuaKiemTra kq WHERE kq.maLan=lk.maLan
        ) tong
        OUTER APPLY (
          SELECT STRING_AGG(CONVERT(NVARCHAR(MAX), CONCAT(nd.noiDung, N': ', COALESCE(kq.ghiChu,N'Chưa có ghi chú'))), N' | ') AS noiDungCanLuuY
          FROM KetQuaKiemTra kq
          JOIN NoiDungKiemTra nd ON nd.maNoiDung=kq.maNoiDung
          WHERE kq.maLan=lk.maLan AND kq.ketQua='KhongDat'
        ) khongDat
        WHERE pc.maCa=@0 AND pc.viTri IN (N'Pha chế',N'Thu ngân',N'Khu vực phục vụ')
        ORDER BY CASE pc.viTri WHEN N'Pha chế' THEN 1 WHEN N'Thu ngân' THEN 2 ELSE 3 END
      `, [maCa]),
      this.dataSource.query(`
        SELECT maSuCo,noiDung,mucDo,trangThai,canBanGiaoCaSau,viTriPhatSinh,
          CONVERT(VARCHAR(19),thoiGianPhatSinh,120) AS thoiGianPhatSinh
        FROM SuCo WHERE maCa=@0
        ORDER BY thoiGianPhatSinh DESC,maSuCo DESC
      `, [maCa]),
    ]);
    return { checklist, suCo };
  }

  private async khoaGiaoDich(runner: QueryRunner) {
    const rows: Array<{ ketQua: number }> = await runner.query(`
      DECLARE @ketQua INT;
      EXEC @ketQua=sys.sp_getapplock
        @Resource=N'QuanLyCaTruc_PhanCongCa',
        @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
      SELECT @ketQua AS ketQua;
    `);
    if (!rows.length || Number(rows[0].ketQua) < 0) {
      throw new ConflictException('Có thao tác bàn giao khác đang xử lý, vui lòng thử lại');
    }
  }

  async lapBienBan(request: BanGiaoCaRequest, dto: LapBienBanDto) {
    const tongKet = dto.tongKetVanHanh.trim();
    const tonDong = (dto.noiDungTonDong ?? '').trim();
    if (tongKet.length < 10) throw new BadRequestException('Tổng kết vận hành cần ít nhất 10 ký tự');
    const user = await this.layTaiKhoan(request);
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      await runner.startTransaction();
      await this.khoaGiaoDich(runner);
      const ca = (await this.layCa(user.maNhanSu, runner)).find(c => c.maCa === dto.maCaBanGiao);
      if (!ca) throw new ForbiddenException('Bạn không được phân công làm Trưởng ca của ca này');
      if (!ca.maCaTiepNhan || !ca.maPhanCongNhan || !ca.maNhanSuNhan) {
        throw new ConflictException('Ca kế tiếp chưa có Trưởng ca được phân công');
      }
      if (ca.maNhanSuGiao === ca.maNhanSuNhan) {
        throw new ConflictException('Không thể tự lập và tiếp nhận biên bản cho hai ca');
      }
      if (Number(ca.soNhanVien) !== 4) {
        throw new ConflictException('Ca bàn giao phải được phân công đủ bốn vị trí');
      }
      const duNhanSu: Array<{ tong: number }> = await runner.query(
        `SELECT COUNT(*) AS tong FROM PhanCongCa WHERE maCa=@0`, [ca.maCaTiepNhan],
      );
      if (Number(duNhanSu[0]?.tong) !== 4) {
        throw new ConflictException('Ca tiếp nhận phải được phân công đủ bốn vị trí');
      }
      if (Number(ca.soSuCoTonDong) > 0 && tonDong.length < 10) {
        throw new BadRequestException('Ca có sự cố tồn đọng. Hãy mô tả việc cần theo dõi trong nội dung bàn giao');
      }

      if (ca.maBienBan) {
        if (ca.trangThai !== 'ChoTiepNhan' || Number(ca.canBoSung) !== 1) {
          throw new ConflictException('Biên bản đã được lập. Chỉ được bổ sung khi Trưởng ca nhận yêu cầu');
        }
        await runner.query(`
          UPDATE BienBanBanGiaoCa
          SET tongKetVanHanh=@0,noiDungTonDong=@1,canBoSung=0,thoiGianCapNhat=SYSDATETIME()
          WHERE maBienBan=@2 AND maPhanCongGiao=@3
            AND trangThai='ChoTiepNhan' AND canBoSung=1
        `, [tongKet, tonDong || null, ca.maBienBan, ca.maPhanCongGiao]);
        await runner.commitTransaction();
        return { maBienBan: ca.maBienBan, trangThai: 'ChoTiepNhan', thongBao: 'Đã bổ sung biên bản, chờ Trưởng ca sau xác nhận' };
      }
      if (Number(ca.coTheLap) !== 1) {
        throw new ConflictException('Chỉ lập biên bản trong giờ ca đang làm việc');
      }
      const maBienBan = `BB${randomUUID().replace(/-/g, '').slice(0, 18)}`;
      await runner.query(`
        INSERT INTO BienBanBanGiaoCa (
          maBienBan,maCaBanGiao,maCaTiepNhan,maPhanCongGiao,maPhanCongNhan,
          tongKetVanHanh,noiDungTonDong,trangThai,thoiGianLap,canBoSung
        ) VALUES (@0,@1,@2,@3,@4,@5,@6,'ChoTiepNhan',SYSDATETIME(),0)
      `, [maBienBan, ca.maCa, ca.maCaTiepNhan, ca.maPhanCongGiao, ca.maPhanCongNhan, tongKet, tonDong || null]);
      await runner.commitTransaction();
      return { maBienBan, trangThai: 'ChoTiepNhan', thongBao: 'Đã lập biên bản bàn giao ca' };
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async phanHoi(request: BanGiaoCaRequest, dto: PhanHoiBienBanDto) {
    const ghiChu = (dto.ghiChu ?? '').trim();
    if (dto.ketQua === 'CanBoSung' && ghiChu.length < 5) {
      throw new BadRequestException('Cần nhập ghi chú bổ sung ít nhất 5 ký tự');
    }
    const user = await this.layTaiKhoan(request);
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      await runner.startTransaction();
      await this.khoaGiaoDich(runner);
      const rows: Array<{
        maBienBan: string;
        trangThai: string;
        canBoSung: number | boolean;
        maNhanSu: string;
        viTri: string;
        coTheNhan: number;
      }> = await runner.query(`
        SELECT bb.maBienBan,bb.trangThai,bb.canBoSung,pcNhan.maNhanSu,pcNhan.viTri,
          CASE WHEN caNhan.trangThai IN ('DaPhanCong','DangDienRa','ChoBanGiao')
            AND SYSDATETIME()>=DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS TIME),caNhan.gioBatDau),CAST(caNhan.ngayLam AS DATETIME2))
            AND SYSDATETIME()<DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS TIME),caNhan.gioKetThuc),CAST(caNhan.ngayLam AS DATETIME2))
          THEN 1 ELSE 0 END AS coTheNhan
        FROM BienBanBanGiaoCa bb WITH (UPDLOCK,HOLDLOCK)
        JOIN PhanCongCa pcNhan ON pcNhan.maPhanCong=bb.maPhanCongNhan
          AND pcNhan.maCa=bb.maCaTiepNhan
        JOIN CaLamViec caNhan ON caNhan.maCa=bb.maCaTiepNhan
        WHERE bb.maBienBan=@0
      `, [dto.maBienBan]);
      const bb = rows[0];
      if (!bb) throw new NotFoundException('Không có biên bản cần tiếp nhận');
      if (bb.maNhanSu !== user.maNhanSu || bb.viTri !== 'Trưởng ca') {
        throw new ForbiddenException('Chỉ Trưởng ca của ca nhận mới được xác nhận biên bản');
      }
      if (Number(bb.coTheNhan) !== 1) {
        throw new ConflictException('Chỉ được phản hồi biên bản khi ca tiếp nhận đang diễn ra');
      }
      if (bb.trangThai !== 'ChoTiepNhan') {
        throw new ConflictException('Biên bản đã được tiếp nhận, không thể xử lý lại');
      }
      if (dto.ketQua === 'DaTiepNhan') {
        if (Number(bb.canBoSung) === 1) {
          throw new ConflictException('Biên bản đang chờ Trưởng ca trước bổ sung');
        }
        await runner.query(`
          UPDATE BienBanBanGiaoCa SET trangThai='DaTiepNhan',
            thoiGianTiepNhan=SYSDATETIME(),canBoSung=0
          WHERE maBienBan=@0 AND trangThai='ChoTiepNhan' AND canBoSung=0
        `, [dto.maBienBan]);
      } else {
        if (Number(bb.canBoSung) === 1) {
          throw new ConflictException('Đã gửi yêu cầu bổ sung, đang chờ Trưởng ca trước cập nhật');
        }
        await runner.query(`
          UPDATE BienBanBanGiaoCa SET canBoSung=1,
            ghiChuYeuCauBoSung=@0,thoiGianYeuCauBoSung=SYSDATETIME()
          WHERE maBienBan=@1 AND trangThai='ChoTiepNhan' AND canBoSung=0
        `, [ghiChu, dto.maBienBan]);
      }
      await runner.commitTransaction();
      return { thongBao: dto.ketQua === 'DaTiepNhan'
        ? 'Đã xác nhận tiếp nhận biên bản'
        : 'Đã gửi yêu cầu bổ sung cho Trưởng ca bàn giao' };
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}
