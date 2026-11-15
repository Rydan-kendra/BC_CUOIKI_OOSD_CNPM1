import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { SuaCaDto, TaoCaDto } from './dto/luu-ca.dto.js';

@Injectable()
export class QuanLyCaService {
  constructor(private readonly dataSource: DataSource) {}

  private kiemTraNgayGio(dto: SuaCaDto) {
    const ngay = new Date(`${dto.ngayLam}T00:00:00Z`);

    if (
      Number.isNaN(ngay.getTime()) ||
      ngay.toISOString().slice(0, 10) !== dto.ngayLam
    ) {
      throw new BadRequestException('Ngày làm việc không hợp lệ');
    }

    const dinhDangGio = /^([01]\d|2[0-3]):[0-5]\d$/;

    if (
      !dinhDangGio.test(dto.gioBatDau) ||
      !dinhDangGio.test(dto.gioKetThuc) ||
      dto.gioBatDau < '06:00' ||
      dto.gioKetThuc > '22:00' ||
      dto.gioBatDau >= dto.gioKetThuc
    ) {
      throw new BadRequestException(
        'Giờ ca phải hợp lệ, bắt đầu trước kết thúc và nằm trong 06:00–22:00',
      );
    }
  }

  private kiemTraCaMacDinh(dto: SuaCaDto) {
    const macDinh =
      (dto.gioBatDau === '06:00' && dto.gioKetThuc === '14:00') ||
      (dto.gioBatDau === '14:00' && dto.gioKetThuc === '22:00');

    if (!macDinh) {
      throw new BadRequestException(
        'Ca mới phải dùng khung giờ chuẩn 06:00–14:00 hoặc 14:00–22:00',
      );
    }
  }

  private kiemTraGioSua(
    dto: SuaCaDto,
    caHienTai: { gioBatDau: string },
  ) {
    const laCaSang = caHienTai.gioBatDau.slice(0, 5) < '14:00';

    if (laCaSang) {
      if (dto.gioBatDau >= '14:00' || dto.gioKetThuc > '14:00') {
        throw new BadRequestException(
          'Ca sáng chỉ được điều chỉnh trong khoảng 06:00–14:00',
        );
      }
    } else if (dto.gioBatDau < '14:00') {
      throw new BadRequestException(
        'Ca chiều chỉ được điều chỉnh trong khoảng 14:00–22:00',
      );
    }
  }

  private async khoaGiaoDich(queryRunner: QueryRunner) {
    const result: Array<{ ketQua: number }> = await queryRunner.query(`
      DECLARE @ketQua INT;
      EXEC @ketQua = sys.sp_getapplock
        @Resource = N'QuanLyCaTruc_PhanCongCa',
        @LockMode = 'Exclusive',
        @LockOwner = 'Transaction',
        @LockTimeout = 5000;
      SELECT @ketQua AS ketQua;
    `);

    if (!result[0] || Number(result[0].ketQua) < 0) {
      throw new ConflictException(
        'Hệ thống đang cập nhật lịch ca. Vui lòng thử lại.',
      );
    }
  }

  private async kiemTraTrungCa(
    queryRunner: QueryRunner,
    maCa: string,
    dto: SuaCaDto,
  ) {
    const trung: Array<{ maCa: string }> = await queryRunner.query(
      `
      SELECT TOP (1) maCa
      FROM CaLamViec WITH (UPDLOCK, HOLDLOCK)
      WHERE maCa <> @0
        AND ngayLam = CONVERT(DATE, @1, 23)
        AND gioBatDau < CONVERT(TIME, @2)
        AND gioKetThuc > CONVERT(TIME, @3)
      `,
      [maCa, dto.ngayLam, dto.gioKetThuc, dto.gioBatDau],
    );

    if (trung.length) {
      throw new ConflictException(
        `Khung giờ bị trùng với ca ${trung[0].maCa}`,
      );
    }
  }

  async taoCa(dto: TaoCaDto) {
    this.kiemTraNgayGio(dto);
    this.kiemTraCaMacDinh(dto);
    const maCa = dto.maCa.trim();

    if (!maCa) {
      throw new BadRequestException('Mã ca không được để trống');
    }

    return this.dataSource.transaction(async (manager) => {
      const queryRunner = manager.queryRunner!;
      await this.khoaGiaoDich(queryRunner);

      const daCo: Array<{ maCa: string }> = await queryRunner.query(
        'SELECT maCa FROM CaLamViec WITH (UPDLOCK, HOLDLOCK) WHERE maCa = @0',
        [maCa],
      );

      if (daCo.length) {
        throw new ConflictException('Mã ca đã tồn tại');
      }

      await this.kiemTraTrungCa(queryRunner, maCa, dto);

      await queryRunner.query(
        `
        INSERT INTO CaLamViec
          (maCa, ngayLam, gioBatDau, gioKetThuc, trangThai)
        VALUES
          (@0, CONVERT(DATE, @1, 23), CONVERT(TIME, @2),
           CONVERT(TIME, @3), 'ChuaPhanCong')
        `,
        [maCa, dto.ngayLam, dto.gioBatDau, dto.gioKetThuc],
      );

      return {
        message: 'Tạo ca làm việc thành công',
        maCa,
        trangThai: 'ChuaPhanCong',
      };
    });
  }

  async suaCa(maCa: string, dto: SuaCaDto) {
    this.kiemTraNgayGio(dto);

    return this.dataSource.transaction(async (manager) => {
      const queryRunner = manager.queryRunner!;
      await this.khoaGiaoDich(queryRunner);

      const cacCa: Array<{ trangThai: string; gioBatDau: string; ngayLam: string }> = await queryRunner.query(
        `
        SELECT
          trangThai,
          CONVERT(VARCHAR(10), ngayLam, 23) AS ngayLam,
          CONVERT(VARCHAR(5), gioBatDau, 108) AS gioBatDau
        FROM CaLamViec WITH (UPDLOCK, HOLDLOCK)
        WHERE maCa = @0
        `,
        [maCa],
      );

      if (!cacCa.length) {
        throw new NotFoundException('Không tìm thấy ca làm việc');
      }

      if (cacCa[0].ngayLam !== dto.ngayLam) {
        throw new BadRequestException(
          'Không được thay đổi ngày làm việc của ca đã được tạo sẵn',
        );
      }

      this.kiemTraGioSua(dto, cacCa[0]);

      if (cacCa[0].trangThai !== 'ChuaPhanCong') {
        throw new ConflictException(
          'Chỉ được sửa thời gian ca chưa hoàn tất phân công',
        );
      }

      const phanCong: Array<{ soLuong: number }> = await queryRunner.query(
        'SELECT COUNT(*) AS soLuong FROM PhanCongCa WHERE maCa = @0',
        [maCa],
      );

      if (Number(phanCong[0]?.soLuong ?? 0) > 0) {
        throw new ConflictException(
          'Ca đã có nhân sự được phân công nên không thể đổi thời gian',
        );
      }

      await this.kiemTraTrungCa(queryRunner, maCa, dto);

      await queryRunner.query(
        `
        UPDATE CaLamViec
        SET ngayLam = CONVERT(DATE, @1, 23),
            gioBatDau = CONVERT(TIME, @2),
            gioKetThuc = CONVERT(TIME, @3)
        WHERE maCa = @0
        `,
        [maCa, dto.ngayLam, dto.gioBatDau, dto.gioKetThuc],
      );

      return { message: 'Cập nhật ca làm việc thành công', maCa };
    });
  }
}
