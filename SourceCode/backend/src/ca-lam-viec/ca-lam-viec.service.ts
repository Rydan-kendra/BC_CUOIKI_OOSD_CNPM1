import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CaLamViec } from './ca-lam-viec.entity.js';

type NguoiDuocPhanCong = {
  maPhanCong: string;
  maNhanSu: string;
  hoTen: string;
  loaiNhanSu: string;
  viTri: string;
};

type CaTrongCoSoDuLieu = {
  ngayLam: string;
  gioBatDau: string;
  gioKetThuc: string;
};

@Injectable()
export class CaLamViecService implements OnModuleInit {
  private ngayDaDamBao = '';

  constructor(
    @InjectRepository(CaLamViec)
    private readonly caRepository: Repository<CaLamViec>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.damBaoCa30Ngay();
  }

  private ngayHienTaiVietNam(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const giaTri = (type: string) =>
      parts.find((part) => part.type === type)?.value ?? '';

    return `${giaTri('year')}-${giaTri('month')}-${giaTri('day')}`;
  }

  private ngayCongThem(ngay: string, soNgay: number): string {
    const date = new Date(`${ngay}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + soNgay);
    return date.toISOString().slice(0, 10);
  }

  private async damBaoCa30Ngay(): Promise<void> {
    const homNay = this.ngayHienTaiVietNam();

    if (this.ngayDaDamBao === homNay) {
      return;
    }

    const ngayCuoi = this.ngayCongThem(homNay, 29);

    await this.dataSource.transaction(async (manager) => {
      const queryRunner = manager.queryRunner!;

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
        throw new ConflictException(
          'Hệ thống đang cập nhật lịch ca. Vui lòng thử lại.',
        );
      }

      const cacCa: CaTrongCoSoDuLieu[] = await queryRunner.query(
        `
        SELECT
          CONVERT(VARCHAR(10), ngayLam, 23) AS ngayLam,
          CONVERT(VARCHAR(5), gioBatDau, 108) AS gioBatDau,
          CONVERT(VARCHAR(5), gioKetThuc, 108) AS gioKetThuc
        FROM CaLamViec WITH (UPDLOCK, HOLDLOCK)
        WHERE ngayLam BETWEEN CONVERT(DATE, @0, 23)
          AND CONVERT(DATE, @1, 23)
        `,
        [homNay, ngayCuoi],
      );

      const mauCa = [
        { kyHieu: 'S', gioBatDau: '06:00', gioKetThuc: '14:00' },
        { kyHieu: 'C', gioBatDau: '14:00', gioKetThuc: '22:00' },
      ];

      for (let i = 0; i < 30; i += 1) {
        const ngayLam = this.ngayCongThem(homNay, i);

        for (const mau of mauCa) {
          const daCoCaTrongKhung = cacCa.some(
            (ca) =>
              ca.ngayLam === ngayLam &&
              ca.gioBatDau >= mau.gioBatDau &&
              ca.gioBatDau < mau.gioKetThuc,
          );

          if (daCoCaTrongKhung) {
            continue;
          }

          const caChongCheo = cacCa.some(
            (ca) =>
              ca.ngayLam === ngayLam &&
              ca.gioBatDau < mau.gioKetThuc &&
              ca.gioKetThuc > mau.gioBatDau,
          );

          if (caChongCheo) {
            throw new ConflictException(
              `Ngày ${ngayLam} có ca chồng chéo với khung giờ mặc định. Cần kiểm tra dữ liệu.`,
            );
          }

          const maCa = `AUTO${ngayLam.replace(/-/g, '')}${mau.kyHieu}`;

          await queryRunner.query(
            `
            INSERT INTO CaLamViec (
              maCa, ngayLam, gioBatDau, gioKetThuc, trangThai
            )
            VALUES (
              @0, CONVERT(DATE, @1, 23), CONVERT(TIME, @2),
              CONVERT(TIME, @3), 'ChuaPhanCong'
            )
            `,
            [maCa, ngayLam, mau.gioBatDau, mau.gioKetThuc],
          );

          cacCa.push({
            ngayLam,
            gioBatDau: mau.gioBatDau,
            gioKetThuc: mau.gioKetThuc,
          });
        }
      }
    });

    this.ngayDaDamBao = homNay;
  }

  async findAll(): Promise<CaLamViec[]> {
    await this.damBaoCa30Ngay();

    return this.caRepository.find({
      order: {
        ngayLam: 'ASC',
        gioBatDau: 'ASC',
      },
    });
  }

  async findOne(id: string): Promise<CaLamViec> {
    const ca = await this.caRepository.findOneBy({ maCa: id });

    if (!ca) {
      throw new NotFoundException('Không tìm thấy ca làm việc');
    }

    return ca;
  }

  async findLichLamViec() {
    const danhSachCa = await this.findAll();

    const danhSachPhanCong: Array<
      NguoiDuocPhanCong & { maCa: string }
    > = await this.dataSource.query(`
      SELECT
        pc.maPhanCong,
        pc.maCa,
        pc.maNhanSu,
        ns.hoTen,
        ns.loaiNhanSu,
        pc.viTri
      FROM PhanCongCa AS pc
      INNER JOIN NhanSu AS ns
        ON ns.maNhanSu = pc.maNhanSu
    `);

    const thuTuViTri = [
      'Trưởng ca',
      'Pha chế',
      'Thu ngân',
      'Khu vực phục vụ',
    ];

    return danhSachCa.map((ca) => {
      const phanCong = danhSachPhanCong
        .filter((nguoi) => nguoi.maCa === ca.maCa)
        .sort(
          (a, b) =>
            thuTuViTri.indexOf(a.viTri) -
            thuTuViTri.indexOf(b.viTri),
        );

      return {
        maCa: ca.maCa,
        ngayLam: ca.ngayLam,
        gioBatDau: ca.gioBatDau,
        gioKetThuc: ca.gioKetThuc,
        trangThai: ca.trangThai,
        soNguoiDaPhanCong: phanCong.length,
        phanCong,
      };
    });
  }
}
