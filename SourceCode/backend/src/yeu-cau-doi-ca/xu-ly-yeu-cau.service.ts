import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { decodeJwt } from 'jose';
import { DataSource } from 'typeorm';
import { XuLyYeuCauDto } from './dto/xu-ly-yeu-cau.dto.js';
import type { YeuCauRequest } from './yeu-cau-doi-ca.controller.js';

type TaiKhoanQuanLy = {
  maTaiKhoan: string;
};

type YeuCauChoDuyet = {
  maYeuCau: string;
  maNhanSuGui: string;
  maPhanCongGoc: string;
  maCaDeXuat: string;
  trangThai: string;
};

type PhanCong = {
  maPhanCong: string;
  maCa: string;
  maNhanSu: string;
  viTri: string;
  loaiNhanSu: string;
};

type CaLamViec = {
  maCa: string;
  ngayLam: string;
  gioBatDau: string;
  gioKetThuc: string;
  trangThai: string;
  chuaBatDau: number;
};

@Injectable()
export class XuLyYeuCauService {
  constructor(private readonly dataSource: DataSource) {}

  private async layQuanLy(request: YeuCauRequest): Promise<string> {
    const bearer = request.headers.authorization ?? '';
    if (!bearer.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bạn cần đăng nhập');
    }

    let sub: string | undefined;
    try {
      sub = decodeJwt(bearer.slice(7)).sub;
    } catch {
      throw new UnauthorizedException('Token không hợp lệ');
    }

    if (!sub) {
      throw new UnauthorizedException('Token không có mã định danh');
    }

    const taiKhoan: TaiKhoanQuanLy[] = await this.dataSource.query(
      `
      SELECT TOP (1) maTaiKhoan
      FROM TaiKhoan
      WHERE oidcSubject = @0
        AND trangThai = 'HoatDong'
        AND nhomQuyen = 'QuanLy'
      `,
      [sub],
    );

    if (!taiKhoan.length) {
      throw new ForbiddenException('Chỉ quản lý cửa hàng được xét duyệt yêu cầu');
    }

    return taiKhoan[0].maTaiKhoan;
  }

  async layDanhSach(request: YeuCauRequest) {
    await this.layQuanLy(request);

    const yeuCau = await this.dataSource.query(`
      SELECT
        yc.maYeuCau,
        yc.maNhanSuGui,
        ns.hoTen AS tenNguoiGui,
        yc.maPhanCongGoc,
        pg.maNhanSu AS maNhanSuDangGiuCaGoc,
        pg.viTri AS viTriGoc,
        pg.maCa AS maCaGoc,
        yc.maCaDeXuat,
        yc.lyDo,
        yc.lyDoTuChoi,
        yc.trangThai,
        CONVERT(VARCHAR(19), yc.thoiGianGui, 120) AS thoiGianGui,
        CONVERT(VARCHAR(19), yc.thoiGianXuLy, 120) AS thoiGianXuLy,
        tk.tenDangNhap AS nguoiXuLy,
        CONVERT(VARCHAR(10), cg.ngayLam, 23) AS ngayCaGoc,
        CONVERT(VARCHAR(8), cg.gioBatDau, 108) AS gioBatDauGoc,
        CONVERT(VARCHAR(8), cg.gioKetThuc, 108) AS gioKetThucGoc,
        cg.trangThai AS trangThaiCaGoc,
        CONVERT(VARCHAR(10), cd.ngayLam, 23) AS ngayCaDeXuat,
        CONVERT(VARCHAR(8), cd.gioBatDau, 108) AS gioBatDauDeXuat,
        CONVERT(VARCHAR(8), cd.gioKetThuc, 108) AS gioKetThucDeXuat,
        cd.trangThai AS trangThaiCaDeXuat
      FROM YeuCauDoiCa AS yc
      INNER JOIN NhanSu AS ns ON ns.maNhanSu = yc.maNhanSuGui
      INNER JOIN PhanCongCa AS pg ON pg.maPhanCong = yc.maPhanCongGoc
      INNER JOIN CaLamViec AS cg ON cg.maCa = pg.maCa
      INNER JOIN CaLamViec AS cd ON cd.maCa = yc.maCaDeXuat
      LEFT JOIN TaiKhoan AS tk ON tk.maTaiKhoan = yc.maTaiKhoanDuyet
      ORDER BY CASE WHEN yc.trangThai = 'ChoXetDuyet' THEN 0 ELSE 1 END, yc.thoiGianGui DESC
    `);

    const nhanSuCaDeXuat = await this.dataSource.query(`
      SELECT
        pc.maPhanCong,
        pc.maCa,
        pc.maNhanSu,
        ns.hoTen,
        ns.loaiNhanSu,
        pc.viTri
      FROM PhanCongCa AS pc
      INNER JOIN NhanSu AS ns ON ns.maNhanSu = pc.maNhanSu
      WHERE pc.maCa IN (
        SELECT DISTINCT maCaDeXuat
        FROM YeuCauDoiCa
        WHERE trangThai = 'ChoXetDuyet'
      )
      ORDER BY pc.maCa, CASE pc.viTri
        WHEN N'Trưởng ca' THEN 1
        WHEN N'Pha chế' THEN 2
        WHEN N'Thu ngân' THEN 3
        ELSE 4 END
    `);

    return { yeuCau, nhanSuCaDeXuat };
  }

  private kiemTraDuBonNguoi(phanCong: PhanCong[], maCa: string) {
    const viTriBatBuoc = ['Trưởng ca', 'Pha chế', 'Thu ngân', 'Khu vực phục vụ'];
    if (
      phanCong.length !== 4 ||
      new Set(phanCong.map((pc) => pc.maNhanSu)).size !== 4 ||
      new Set(phanCong.map((pc) => pc.viTri)).size !== 4 ||
      !viTriBatBuoc.every((viTri) => phanCong.some((pc) => pc.viTri === viTri))
    ) {
      throw new BadRequestException(`Ca ${maCa} không đủ 4 người ở 4 vị trí khác nhau`);
    }

    if (!phanCong.some((pc) => pc.loaiNhanSu === 'ToanThoiGian')) {
      throw new BadRequestException(`Ca ${maCa} phải có ít nhất 1 nhân viên toàn thời gian`);
    }

    const quanLy = phanCong.find((pc) => pc.loaiNhanSu === 'QuanLy');
    const truongCa = phanCong.find((pc) => pc.viTri === 'Trưởng ca');
    if (!truongCa || (quanLy && quanLy.maNhanSu !== truongCa.maNhanSu)) {
      throw new BadRequestException(`Nếu quản lý tham gia ca ${maCa}, quản lý phải là Trưởng ca`);
    }
    if (!quanLy && truongCa.loaiNhanSu !== 'ToanThoiGian') {
      throw new BadRequestException(`Trưởng ca ${maCa} phải là nhân viên toàn thời gian`);
    }
  }

  async xuLy(request: YeuCauRequest, dto: XuLyYeuCauDto) {
    const maTaiKhoanDuyet = await this.layQuanLy(request);
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
        throw new ConflictException('Hệ thống đang cập nhật phân công. Vui lòng thử lại');
      }

      const danhSach: YeuCauChoDuyet[] = await queryRunner.query(
        `
        SELECT maYeuCau, maNhanSuGui, maPhanCongGoc, maCaDeXuat, trangThai
        FROM YeuCauDoiCa WITH (UPDLOCK, HOLDLOCK)
        WHERE maYeuCau = @0
        `,
        [dto.maYeuCau],
      );
      const yeuCau = danhSach[0];
      if (!yeuCau) throw new NotFoundException('Không tìm thấy yêu cầu đổi ca');
      if (yeuCau.trangThai !== 'ChoXetDuyet') {
        throw new ConflictException('Yêu cầu này đã được xử lý, không được xét duyệt lại');
      }

      if (dto.ketQua === 'DaTuChoi') {
        const lyDo = dto.lyDoTuChoi?.trim() ?? '';
        if (lyDo.length < 5 || lyDo.length > 500) {
          throw new BadRequestException('Lý do từ chối phải có từ 5 đến 500 ký tự');
        }

        await queryRunner.query(
          `
          UPDATE YeuCauDoiCa
          SET trangThai = 'DaTuChoi',
              lyDoTuChoi = @0,
              maTaiKhoanDuyet = @1,
              thoiGianXuLy = SYSDATETIME()
          WHERE maYeuCau = @2 AND trangThai = 'ChoXetDuyet'
          `,
          [lyDo, maTaiKhoanDuyet, yeuCau.maYeuCau],
        );

        await queryRunner.commitTransaction();
        return { thongBao: 'Đã từ chối yêu cầu. Lịch làm việc được giữ nguyên.', trangThai: 'DaTuChoi' };
      }

      if (dto.ketQua !== 'DaChapThuan' || !dto.maPhanCongDoi?.trim()) {
        throw new BadRequestException('Cần chọn nhân sự đổi tương ứng ở ca đề xuất');
      }

      const phanCong: PhanCong[] = await queryRunner.query(
        `
        SELECT pc.maPhanCong, pc.maCa, pc.maNhanSu, pc.viTri, ns.loaiNhanSu
        FROM PhanCongCa AS pc WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN NhanSu AS ns ON ns.maNhanSu = pc.maNhanSu
        WHERE pc.maCa IN (
          SELECT maCa FROM PhanCongCa WHERE maPhanCong = @0
          UNION ALL SELECT @1
        )
        `,
        [yeuCau.maPhanCongGoc, yeuCau.maCaDeXuat],
      );

      const goc = phanCong.find((pc) => pc.maPhanCong === yeuCau.maPhanCongGoc);
      const doi = phanCong.find((pc) => pc.maPhanCong === dto.maPhanCongDoi);
      if (!goc || goc.maNhanSu !== yeuCau.maNhanSuGui) {
        throw new ConflictException('Phân công gốc đã thay đổi trong thời gian chờ duyệt');
      }
      if (!doi || doi.maCa !== yeuCau.maCaDeXuat || doi.maCa === goc.maCa) {
        throw new BadRequestException('Người đổi tương ứng không thuộc ca đề xuất');
      }
      if (goc.maNhanSu === doi.maNhanSu) {
        throw new BadRequestException('Không thể đổi ca với chính mình');
      }

      const cacCa: CaLamViec[] = await queryRunner.query(
        `
        SELECT
          maCa,
          CONVERT(VARCHAR(10), ngayLam, 23) AS ngayLam,
          CONVERT(VARCHAR(8), gioBatDau, 108) AS gioBatDau,
          CONVERT(VARCHAR(8), gioKetThuc, 108) AS gioKetThuc,
          trangThai,
          CASE WHEN DATEADD(MINUTE,
            DATEDIFF(MINUTE, CAST('00:00:00' AS TIME), gioBatDau),
            CAST(ngayLam AS DATETIME2)) > SYSDATETIME()
            THEN 1 ELSE 0 END AS chuaBatDau
        FROM CaLamViec WITH (UPDLOCK, HOLDLOCK)
        WHERE maCa IN (@0, @1)
        `,
        [goc.maCa, doi.maCa],
      );
      const caGoc = cacCa.find((ca) => ca.maCa === goc.maCa);
      const caDoi = cacCa.find((ca) => ca.maCa === doi.maCa);
      if (
        !caGoc || !caDoi ||
        caGoc.trangThai !== 'DaPhanCong' ||
        caDoi.trangThai !== 'DaPhanCong' ||
        Number(caGoc.chuaBatDau) !== 1 ||
        Number(caDoi.chuaBatDau) !== 1
      ) {
        throw new ConflictException('Cả hai ca phải đã phân công và chưa bắt đầu làm việc');
      }

      const duLieuVanHanh: Array<{ daPhatSinh: number }> = await queryRunner.query(
        `
        SELECT CASE WHEN
          EXISTS (SELECT 1 FROM SuCo WHERE maCa IN (@0, @1)) OR
          EXISTS (
            SELECT 1 FROM LanKiemTra AS kt
            INNER JOIN PhanCongCa AS pc ON pc.maPhanCong = kt.maPhanCong
            WHERE pc.maCa IN (@0, @1)
          ) OR EXISTS (
            SELECT 1 FROM BanGiaoTheoViTri AS bg
            INNER JOIN PhanCongCa AS pc ON pc.maPhanCong IN (bg.maPhanCongGiao, bg.maPhanCongNhan)
            WHERE pc.maCa IN (@0, @1)
          ) OR EXISTS (
            SELECT 1 FROM BienBanBanGiaoCa AS bb
            WHERE bb.maCaBanGiao IN (@0, @1) OR bb.maCaTiepNhan IN (@0, @1)
          ) THEN 1 ELSE 0 END AS daPhatSinh
        `,
        [goc.maCa, doi.maCa],
      );
      if (Number(duLieuVanHanh[0]?.daPhatSinh) > 0) {
        throw new ConflictException('Một trong hai ca đã có checklist, sự cố hoặc bàn giao. Không thể đổi trực tiếp');
      }

      const phanCongGoc = phanCong.filter((pc) => pc.maCa === goc.maCa);
      const phanCongDoi = phanCong.filter((pc) => pc.maCa === doi.maCa);
      const sauDoiGoc = phanCongGoc.map((pc) =>
        pc.maPhanCong === goc.maPhanCong
          ? { ...pc, maNhanSu: doi.maNhanSu, loaiNhanSu: doi.loaiNhanSu }
          : pc,
      );
      const sauDoiDich = phanCongDoi.map((pc) =>
        pc.maPhanCong === doi.maPhanCong
          ? { ...pc, maNhanSu: goc.maNhanSu, loaiNhanSu: goc.loaiNhanSu }
          : pc,
      );
      this.kiemTraDuBonNguoi(sauDoiGoc, goc.maCa);
      this.kiemTraDuBonNguoi(sauDoiDich, doi.maCa);

      const trungLich: Array<{ maNhanSu: string; maCa: string }> = await queryRunner.query(
        `
        SELECT TOP (1) pc.maNhanSu, cv.maCa
        FROM PhanCongCa AS pc
        INNER JOIN CaLamViec AS cv ON cv.maCa = pc.maCa
        WHERE pc.maPhanCong NOT IN (@0, @1)
          AND (
            (pc.maNhanSu = @2
              AND cv.ngayLam = CONVERT(DATE, @3, 23)
              AND cv.gioBatDau < CONVERT(TIME, @4)
              AND cv.gioKetThuc > CONVERT(TIME, @5))
            OR
            (pc.maNhanSu = @6
              AND cv.ngayLam = CONVERT(DATE, @7, 23)
              AND cv.gioBatDau < CONVERT(TIME, @8)
              AND cv.gioKetThuc > CONVERT(TIME, @9))
          )
        `,
        [
          goc.maPhanCong,
          doi.maPhanCong,
          doi.maNhanSu,
          caGoc.ngayLam,
          caGoc.gioKetThuc,
          caGoc.gioBatDau,
          goc.maNhanSu,
          caDoi.ngayLam,
          caDoi.gioKetThuc,
          caDoi.gioBatDau,
        ],
      );
      if (trungLich.length > 0) {
        throw new ConflictException(
          `Nhân viên ${trungLich[0].maNhanSu} bị trùng lịch với ca ${trungLich[0].maCa}`,
        );
      }

      await queryRunner.query(
        `
        UPDATE PhanCongCa
        SET maNhanSu = @0, ngayPhanCong = SYSDATETIME()
        WHERE maPhanCong = @1
        `,
        [doi.maNhanSu, goc.maPhanCong],
      );
      await queryRunner.query(
        `
        UPDATE PhanCongCa
        SET maNhanSu = @0, ngayPhanCong = SYSDATETIME()
        WHERE maPhanCong = @1
        `,
        [goc.maNhanSu, doi.maPhanCong],
      );
      await queryRunner.query(
        `
        UPDATE YeuCauDoiCa
        SET trangThai = 'DaChapThuan',
            lyDoTuChoi = NULL,
            maTaiKhoanDuyet = @0,
            thoiGianXuLy = SYSDATETIME()
        WHERE maYeuCau = @1 AND trangThai = 'ChoXetDuyet'
        `,
        [maTaiKhoanDuyet, yeuCau.maYeuCau],
      );
      await queryRunner.commitTransaction();

      return {
        thongBao: 'Đã chấp thuận và cập nhật phân công của hai ca',
        trangThai: 'DaChapThuan',
        maCaGoc: goc.maCa,
        maCaDeXuat: doi.maCa,
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
