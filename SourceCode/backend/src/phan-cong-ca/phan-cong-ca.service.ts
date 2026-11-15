import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { HoanTatPhanCongDto } from './dto/hoan-tat-phan-cong.dto.js';

type NhanSuTrongCa = {
  maNhanSu: string;
  hoTen: string;
  loaiNhanSu: string;
};

type ThongTinCa = {
  maCa: string;
  ngayLam: string;
  gioBatDau: string;
  gioKetThuc: string;
  trangThai: string;
};

type BanGhiPhanCong = {
  maPhanCong: string;
  maNhanSu: string;
  viTri: string;
};

@Injectable()
export class PhanCongCaService {
  constructor(private readonly dataSource: DataSource) {}

  async luuPhanCong(dto: HoanTatPhanCongDto) {
    return this.xuLyPhanCong(dto, true);
  }

  async hoanTatPhanCong(dto: HoanTatPhanCongDto) {
    return this.xuLyPhanCong(dto, false);
  }

  private async xuLyPhanCong(dto: HoanTatPhanCongDto, choPhepSua: boolean) {
    const viTriBatBuoc = [
      'Trưởng ca',
      'Pha chế',
      'Thu ngân',
      'Khu vực phục vụ',
    ];

    if (!dto || typeof dto.maCa !== 'string' || !Array.isArray(dto.phanCong)) {
      throw new BadRequestException('Dữ liệu phân công không hợp lệ');
    }

    if (
      dto.phanCong.length !== 4 ||
      dto.phanCong.some(
        (item) =>
          !item ||
          typeof item.maNhanSu !== 'string' ||
          typeof item.viTri !== 'string',
      )
    ) {
      throw new BadRequestException('Phải gửi đúng 4 người cho 4 vị trí');
    }

    const danhSachMa = dto.phanCong.map((item) => item.maNhanSu.trim());
    const danhSachViTri = dto.phanCong.map((item) => item.viTri);

    if (
      danhSachMa.some((ma) => !ma) ||
      new Set(danhSachMa).size !== 4 ||
      new Set(danhSachViTri).size !== 4 ||
      !viTriBatBuoc.every((viTri) => danhSachViTri.includes(viTri))
    ) {
      throw new BadRequestException(
        'Phải chọn đúng 4 nhân sự khác nhau cho 4 vị trí bắt buộc',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      const khoa: Array<{ ketQua: number }> = await queryRunner.query(`
        DECLARE @ketQua INT;
        EXEC @ketQua = sys.sp_getapplock
          @Resource = N'QuanLyCaTruc_PhanCongCa',
          @LockMode = 'Exclusive',
          @LockOwner = 'Transaction',
          @LockTimeout = 5000;
        SELECT @ketQua AS ketQua;
      `);

      if (!khoa[0] || Number(khoa[0].ketQua) < 0) {
        throw new ConflictException('Đang có yêu cầu phân công khác. Vui lòng thử lại.');
      }

      const danhSachCa: ThongTinCa[] = await queryRunner.query(
        `
        SELECT
          maCa,
          CONVERT(VARCHAR(10), ngayLam, 23) AS ngayLam,
          CONVERT(VARCHAR(8), gioBatDau, 108) AS gioBatDau,
          CONVERT(VARCHAR(8), gioKetThuc, 108) AS gioKetThuc,
          trangThai
        FROM CaLamViec WITH (UPDLOCK, HOLDLOCK)
        WHERE maCa = @0
        `,
        [dto.maCa],
      );

      const ca = danhSachCa[0];
      if (!ca) {
        throw new NotFoundException('Không tìm thấy ca làm việc');
      }

      const trangThaiChoPhep = choPhepSua
        ? ['ChuaPhanCong', 'DaPhanCong']
        : ['ChuaPhanCong'];

      if (!trangThaiChoPhep.includes(ca.trangThai)) {
        throw new ConflictException(
          'Chỉ có thể lưu phân công khi ca chưa bắt đầu vận hành hoặc chưa bàn giao',
        );
      }

      const caHopLe =
        ca.gioBatDau >= '06:00:00' &&
        ca.gioKetThuc <= '22:00:00' &&
        ca.gioBatDau < ca.gioKetThuc &&
        ((ca.gioBatDau < '14:00:00' && ca.gioKetThuc <= '14:00:00') ||
          (ca.gioBatDau >= '14:00:00' && ca.gioKetThuc <= '22:00:00'));

      if (!caHopLe) {
        throw new BadRequestException('Thời gian ca nằm ngoài khung giờ vận hành');
      }

      const nhanSu: NhanSuTrongCa[] = await queryRunner.query(
        `
        SELECT maNhanSu, hoTen, loaiNhanSu
        FROM NhanSu
        WHERE maNhanSu IN (@0, @1, @2, @3)
        `,
        danhSachMa,
      );

      if (nhanSu.length !== 4) {
        throw new BadRequestException('Một hoặc nhiều nhân sự không tồn tại');
      }

      const coNhanVienToanThoiGian = nhanSu.some(
        (item) => item.loaiNhanSu === 'ToanThoiGian',
      );
      if (!coNhanVienToanThoiGian) {
        throw new BadRequestException('Ca phải có ít nhất một nhân viên toàn thời gian');
      }

      const maTruongCa = dto.phanCong.find(
        (item) => item.viTri === 'Trưởng ca',
      )!.maNhanSu.trim();
      const truongCa = nhanSu.find((item) => item.maNhanSu === maTruongCa)!;
      const quanLyThamGia = nhanSu.find(
        (item) => item.loaiNhanSu === 'QuanLy',
      );

      if (quanLyThamGia && quanLyThamGia.maNhanSu !== maTruongCa) {
        throw new BadRequestException('Quản lý tham gia ca phải giữ vị trí Trưởng ca');
      }
      if (!quanLyThamGia && truongCa.loaiNhanSu !== 'ToanThoiGian') {
        throw new BadRequestException(
          'Nếu quản lý không tham gia, Trưởng ca phải là nhân viên toàn thời gian',
        );
      }

      const trungLich: Array<{ maNhanSu: string; maCa: string }> =
        await queryRunner.query(
          `
          SELECT TOP (1) pc.maNhanSu, cv.maCa
          FROM PhanCongCa AS pc
          INNER JOIN CaLamViec AS cv ON cv.maCa = pc.maCa
          WHERE pc.maNhanSu IN (@0, @1, @2, @3)
            AND cv.maCa <> @4
            AND cv.ngayLam = CONVERT(DATE, @5, 23)
            AND cv.gioBatDau < CONVERT(TIME, @6)
            AND cv.gioKetThuc > CONVERT(TIME, @7)
          `,
          [
            ...danhSachMa,
            dto.maCa,
            ca.ngayLam,
            ca.gioKetThuc,
            ca.gioBatDau,
          ],
        );

      if (trungLich.length > 0) {
        throw new ConflictException(
          `Nhân sự ${trungLich[0].maNhanSu} đã có lịch trùng ca ${trungLich[0].maCa}`,
        );
      }

      const phanCongCu: BanGhiPhanCong[] = await queryRunner.query(
        `
        SELECT maPhanCong, maNhanSu, viTri
        FROM PhanCongCa WITH (UPDLOCK, HOLDLOCK)
        WHERE maCa = @0
        `,
        [dto.maCa],
      );

      if (
        (ca.trangThai === 'ChuaPhanCong' && phanCongCu.length > 0) ||
        (ca.trangThai === 'DaPhanCong' && phanCongCu.length !== 4)
      ) {
        throw new ConflictException(
          'Dữ liệu phân công và trạng thái ca không đồng nhất. Cần kiểm tra trước khi sửa.',
        );
      }

      const daThayDoi = viTriBatBuoc.some((viTri) => {
        const truoc = phanCongCu.find((item) => item.viTri === viTri);
        const sau = dto.phanCong.find((item) => item.viTri === viTri);
        return truoc?.maNhanSu !== sau?.maNhanSu.trim();
      });

      if (!daThayDoi) {
        await queryRunner.commitTransaction();
        return {
          thongBao: 'Phân công không có thay đổi',
          maCa: ca.maCa,
          trangThai: ca.trangThai,
          soNguoi: phanCongCu.length,
          phanCong: dto.phanCong,
        };
      }

      if (phanCongCu.length > 0) {
        const lienQuan: Array<{ daPhatSinh: number }> = await queryRunner.query(
          `
          SELECT CASE WHEN
            EXISTS (
              SELECT 1 FROM YeuCauDoiCa AS yc
              INNER JOIN PhanCongCa AS pc ON pc.maPhanCong = yc.maPhanCongGoc
              WHERE pc.maCa = @0
            ) OR EXISTS (
              SELECT 1 FROM LanKiemTra AS kt
              INNER JOIN PhanCongCa AS pc ON pc.maPhanCong = kt.maPhanCong
              WHERE pc.maCa = @0
            ) OR EXISTS (
              SELECT 1 FROM BanGiaoTheoViTri AS bg
              INNER JOIN PhanCongCa AS pc
                ON pc.maPhanCong = bg.maPhanCongGiao
                OR pc.maPhanCong = bg.maPhanCongNhan
              WHERE pc.maCa = @0
            ) OR EXISTS (
              SELECT 1 FROM BienBanBanGiaoCa AS bb
              INNER JOIN PhanCongCa AS pc
                ON pc.maPhanCong = bb.maPhanCongGiao
                OR pc.maPhanCong = bb.maPhanCongNhan
              WHERE pc.maCa = @0
            ) OR EXISTS (
              SELECT 1 FROM SuCo WHERE maCa = @0
            ) THEN 1 ELSE 0 END AS daPhatSinh
          `,
          [dto.maCa],
        );

        if (Number(lienQuan[0]?.daPhatSinh) > 0) {
          throw new ConflictException(
            'Ca đã có yêu cầu đổi ca, checklist, sự cố hoặc bàn giao. Không thể sửa trực tiếp; cần xử lý theo nghiệp vụ liên quan.',
          );
        }

        await queryRunner.query(
          'DELETE FROM PhanCongCa WHERE maCa = @0',
          [dto.maCa],
        );
      }

      for (const viTri of viTriBatBuoc) {
        const maNhanSu = dto.phanCong.find(
          (item) => item.viTri === viTri,
        )!.maNhanSu.trim();
        const maPhanCong =
          phanCongCu.find((item) => item.viTri === viTri)?.maPhanCong ??
          `PC${randomUUID().replace(/-/g, '').slice(0, 18)}`;

        await queryRunner.query(
          `
          INSERT INTO PhanCongCa (
            maPhanCong, maCa, maNhanSu, viTri, ngayPhanCong
          ) VALUES (@0, @1, @2, @3, SYSDATETIME())
          `,
          [maPhanCong, dto.maCa, maNhanSu, viTri],
        );
      }

      if (ca.trangThai === 'ChuaPhanCong') {
        await queryRunner.query(
          `
          UPDATE CaLamViec
          SET trangThai = 'DaPhanCong'
          WHERE maCa = @0 AND trangThai = 'ChuaPhanCong'
          `,
          [dto.maCa],
        );
      }

      await queryRunner.commitTransaction();

      return {
        thongBao: phanCongCu.length > 0
          ? 'Cập nhật phân công thành công'
          : 'Lưu phân công thành công',
        maCa: dto.maCa,
        trangThai: 'DaPhanCong',
        soNguoi: 4,
        phanCong: dto.phanCong,
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
