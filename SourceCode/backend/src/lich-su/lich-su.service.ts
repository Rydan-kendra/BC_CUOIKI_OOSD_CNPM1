import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { decodeJwt } from 'jose';
import { DataSource } from 'typeorm';
import type { LichSuRequest } from './lich-su.controller.js';

type TaiKhoan = { maNhanSu: string; nhomQuyen: 'NhanVien' | 'QuanLy' };
type BoLoc = { loai?: string; tuNgay?: string; denNgay?: string; tuKhoa?: string };
type MucChiTiet = { tieuDe: string; moTa: string; trangThai?: string };
type DienBien = { thoiGian: string; nguoi: string; noiDung: string; trangThai: string };
type KetQuaChiTiet = {
  tieuDe: string;
  thongTin: Array<{ ten: string; giaTri: string }>;
  noiDung: MucChiTiet[];
  dienBien: DienBien[];
  ghiChu?: string;
};

const CAC_LOAI = ['Ca', 'Checklist', 'SuCo', 'BanGiaoViTri', 'DoiCa', 'BienBanCa'] as const;
type Loai = (typeof CAC_LOAI)[number];

@Injectable()
export class LichSuService {
  constructor(private readonly dataSource: DataSource) {}

  private async layTaiKhoan(request: LichSuRequest): Promise<TaiKhoan> {
    const bearer = request.headers.authorization ?? '';
    if (!bearer.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bạn cần đăng nhập để tra cứu lịch sử');
    }
    let sub: string | undefined;
    try {
      sub = decodeJwt(bearer.slice(7)).sub;
    } catch {
      throw new UnauthorizedException('Token đăng nhập không hợp lệ');
    }
    if (!sub) throw new UnauthorizedException('Token thiếu thông tin người dùng');
    const rows: TaiKhoan[] = await this.dataSource.query(
      `SELECT TOP (1) maNhanSu, nhomQuyen FROM TaiKhoan
       WHERE oidcSubject = @0 AND trangThai = 'HoatDong'`,
      [sub],
    );
    if (!rows.length) throw new UnauthorizedException('Tài khoản không còn hoạt động');
    return rows[0];
  }

  private kiemTraLoai(value?: string): Loai {
    if (!value || !CAC_LOAI.includes(value as Loai)) {
      throw new BadRequestException('Nhóm dữ liệu tra cứu không hợp lệ');
    }
    return value as Loai;
  }

  private kiemTraNgay(value?: string): string {
    if (!value) return '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('Ngày phải có định dạng YYYY-MM-DD');
    }
    const ngay = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(ngay.getTime()) || ngay.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException('Ngày tìm kiếm không tồn tại');
    }
    return value;
  }

  private text(value: unknown): string {
    if (value === undefined || value === null) return '—';
    if (typeof value === 'boolean') return value ? 'Có' : 'Không';
    const ketQua = String(value).trim();
    return ketQua || '—';
  }

  private muc(ten: string, value: unknown) {
    return { ten, giaTri: this.text(value) };
  }

  async timKiem(request: LichSuRequest, boLoc: BoLoc) {
    const user = await this.layTaiKhoan(request);
    const loai = this.kiemTraLoai(boLoc.loai ?? 'Ca');
    const tuNgay = this.kiemTraNgay(boLoc.tuNgay);
    const denNgay = this.kiemTraNgay(boLoc.denNgay);
    if (tuNgay && denNgay && tuNgay > denNgay) {
      throw new BadRequestException('Ngày bắt đầu không được lớn hơn ngày kết thúc');
    }
    const tuKhoa = (boLoc.tuKhoa ?? '').trim();
    if (tuKhoa.length > 100) throw new BadRequestException('Từ khóa tối đa 100 ký tự');

    const params = [user.nhomQuyen, user.maNhanSu, tuNgay, denNgay, tuKhoa];
    const ngay = (cot: string) => `
      AND (@2 = '' OR ${cot} >= TRY_CONVERT(DATE, @2, 23))
      AND (@3 = '' OR ${cot} <= TRY_CONVERT(DATE, @3, 23))`;
    const tim = (noiDung: string) => `AND (@4 = '' OR (${noiDung}))`;
    let sql = '';

    switch (loai) {
      case 'Ca':
        sql = `SELECT TOP (100) ca.maCa AS ma, ca.maCa,
          CONVERT(VARCHAR(10),ca.ngayLam,23) AS ngay,
          N'Ca làm việc' AS tieuDe,
          CONCAT(CONVERT(VARCHAR(5),ca.gioBatDau,108),N' – ',CONVERT(VARCHAR(5),ca.gioKetThuc,108)) AS moTa,
          ca.trangThai
          FROM CaLamViec AS ca
          WHERE ca.ngayLam <= CAST(SYSDATETIME() AS DATE)
          AND (@0 = 'QuanLy' OR EXISTS (
            SELECT 1 FROM PhanCongCa pc WHERE pc.maCa=ca.maCa AND pc.maNhanSu=@1))
          ${ngay('ca.ngayLam')}
          ${tim(`ca.maCa LIKE '%' + @4 + '%' OR EXISTS (
            SELECT 1 FROM PhanCongCa pc JOIN NhanSu ns ON ns.maNhanSu=pc.maNhanSu
            WHERE pc.maCa=ca.maCa AND (ns.hoTen LIKE N'%' + @4 + N'%' OR ns.maNhanSu LIKE '%' + @4 + '%'))`)}
          ORDER BY ca.ngayLam DESC,ca.gioBatDau DESC,ca.maCa DESC`;
        break;
      case 'Checklist':
        sql = `SELECT TOP (100) lk.maLan AS ma, pc.maCa,
          CONVERT(VARCHAR(19),lk.thoiGianHoanTat,120) AS ngay,
          ds.tenDanhSach AS tieuDe,
          CONCAT(ns.hoTen,N' · ',pc.viTri) AS moTa,
          lk.trangThai
          FROM LanKiemTra lk
          JOIN PhanCongCa pc ON pc.maPhanCong=lk.maPhanCong
          JOIN CaLamViec ca ON ca.maCa=pc.maCa
          JOIN NhanSu ns ON ns.maNhanSu=pc.maNhanSu
          JOIN DanhSachKiemTra ds ON ds.maDanhSach=lk.maDanhSach
          WHERE lk.trangThai='DaHoanTat' AND (@0='QuanLy' OR pc.maNhanSu=@1)
          ${ngay('ca.ngayLam')}
          ${tim(`pc.maCa LIKE '%' + @4 + '%' OR ns.hoTen LIKE N'%' + @4 + N'%' OR ns.maNhanSu LIKE '%' + @4 + '%' OR ds.tenDanhSach LIKE N'%' + @4 + N'%'`)}
          ORDER BY lk.thoiGianHoanTat DESC, lk.maLan DESC`;
        break;
      case 'SuCo':
        sql = `SELECT TOP (100) sc.maSuCo AS ma,sc.maCa,
          CONVERT(VARCHAR(19),COALESCE(sc.thoiGianGhiNhan,sc.thoiGianPhatSinh),120) AS ngay,
          LEFT(sc.noiDung,100) AS tieuDe,
          CONCAT(ns.hoTen,N' · ',COALESCE(sc.viTriPhatSinh,N'Chưa rõ vị trí')) AS moTa,
          sc.trangThai
          FROM SuCo sc
          JOIN CaLamViec ca ON ca.maCa=sc.maCa
          JOIN NhanSu ns ON ns.maNhanSu=sc.maNhanSuBaoCao
          WHERE (@0='QuanLy' OR EXISTS (
            SELECT 1 FROM PhanCongCa pc WHERE pc.maCa=sc.maCa AND pc.maNhanSu=@1))
          ${ngay('ca.ngayLam')}
          ${tim(`sc.maCa LIKE '%' + @4 + '%' OR sc.maSuCo LIKE '%' + @4 + '%' OR sc.noiDung LIKE N'%' + @4 + N'%' OR ns.hoTen LIKE N'%' + @4 + N'%'`)}
          ORDER BY COALESCE(sc.thoiGianGhiNhan,sc.thoiGianPhatSinh) DESC,sc.maSuCo DESC`;
        break;
      case 'BanGiaoViTri':
        sql = `SELECT TOP (100) bg.maBanGiao AS ma,pcNhan.maCa,
          CONVERT(VARCHAR(19),bg.thoiGianTiepNhan,120) AS ngay,
          CONCAT(N'Bàn giao ',pcNhan.viTri) AS tieuDe,
          CONCAT(nsGiao.hoTen,N' → ',nsNhan.hoTen) AS moTa,
          bg.trangThaiTiepNhan AS trangThai
          FROM BanGiaoTheoViTri bg
          JOIN PhanCongCa pcGiao ON pcGiao.maPhanCong=bg.maPhanCongGiao
          JOIN PhanCongCa pcNhan ON pcNhan.maPhanCong=bg.maPhanCongNhan
          JOIN CaLamViec ca ON ca.maCa=pcNhan.maCa
          JOIN NhanSu nsGiao ON nsGiao.maNhanSu=pcGiao.maNhanSu
          JOIN NhanSu nsNhan ON nsNhan.maNhanSu=pcNhan.maNhanSu
          WHERE (@0='QuanLy' OR pcGiao.maNhanSu=@1 OR pcNhan.maNhanSu=@1)
          ${ngay('ca.ngayLam')}
          ${tim(`pcGiao.maCa LIKE '%' + @4 + '%' OR pcNhan.maCa LIKE '%' + @4 + '%' OR nsGiao.hoTen LIKE N'%' + @4 + N'%' OR nsNhan.hoTen LIKE N'%' + @4 + N'%'`)}
          ORDER BY bg.thoiGianTiepNhan DESC,bg.maBanGiao DESC`;
        break;
      case 'DoiCa':
        sql = `SELECT TOP (100) yc.maYeuCau AS ma,pc.maCa,
          CONVERT(VARCHAR(19),yc.thoiGianGui,120) AS ngay,
          N'Yêu cầu đổi ca' AS tieuDe,
          CONCAT(ns.hoTen,N' · ',pc.maCa,N' → ',yc.maCaDeXuat) AS moTa,
          yc.trangThai
          FROM YeuCauDoiCa yc
          JOIN PhanCongCa pc ON pc.maPhanCong=yc.maPhanCongGoc
          JOIN CaLamViec ca ON ca.maCa=pc.maCa
          JOIN NhanSu ns ON ns.maNhanSu=yc.maNhanSuGui
          WHERE (@0='QuanLy' OR yc.maNhanSuGui=@1)
          ${ngay('ca.ngayLam')}
          ${tim(`pc.maCa LIKE '%' + @4 + '%' OR yc.maCaDeXuat LIKE '%' + @4 + '%' OR ns.hoTen LIKE N'%' + @4 + N'%' OR yc.maYeuCau LIKE '%' + @4 + '%'`)}
          ORDER BY yc.thoiGianGui DESC,yc.maYeuCau DESC`;
        break;
      case 'BienBanCa':
        sql = `SELECT TOP (100) bb.maBienBan AS ma,bb.maCaBanGiao AS maCa,
          CONVERT(VARCHAR(19),bb.thoiGianLap,120) AS ngay,
          N'Biên bản bàn giao ca' AS tieuDe,
          CONCAT(bb.maCaBanGiao,N' → ',bb.maCaTiepNhan) AS moTa,
          bb.trangThai
          FROM BienBanBanGiaoCa bb
          JOIN CaLamViec ca ON ca.maCa=bb.maCaBanGiao
          JOIN PhanCongCa pcGiao ON pcGiao.maPhanCong=bb.maPhanCongGiao
          JOIN PhanCongCa pcNhan ON pcNhan.maPhanCong=bb.maPhanCongNhan
          WHERE (@0='QuanLy' OR pcGiao.maNhanSu=@1 OR pcNhan.maNhanSu=@1)
          ${ngay('ca.ngayLam')}
          ${tim(`bb.maCaBanGiao LIKE '%' + @4 + '%' OR bb.maCaTiepNhan LIKE '%' + @4 + '%' OR bb.tongKetVanHanh LIKE N'%' + @4 + N'%'`)}
          ORDER BY bb.thoiGianLap DESC,bb.maBienBan DESC`;
        break;
    }
    const danhSach = await this.dataSource.query(sql, params);
    return { loai, vaiTro: user.nhomQuyen, danhSach, gioiHan: 100 };
  }

  async chiTiet(request: LichSuRequest, loaiRaw: string, ma: string): Promise<KetQuaChiTiet> {
    const user = await this.layTaiKhoan(request);
    const loai = this.kiemTraLoai(loaiRaw);
    if (!/^[A-Za-z0-9_-]{1,20}$/.test(ma)) {
      throw new BadRequestException('Mã tra cứu không hợp lệ');
    }
    const params = [user.nhomQuyen, user.maNhanSu, ma];
    let rows: Record<string, unknown>[] = [];
    const ketQua: KetQuaChiTiet = { tieuDe: '', thongTin: [], noiDung: [], dienBien: [] };

    switch (loai) {
      case 'Ca': {
        rows = await this.dataSource.query(`
          SELECT ca.maCa,CONVERT(VARCHAR(10),ca.ngayLam,23) AS ngayLam,
          CONVERT(VARCHAR(5),ca.gioBatDau,108) AS batDau,
          CONVERT(VARCHAR(5),ca.gioKetThuc,108) AS ketThuc,ca.trangThai
          FROM CaLamViec ca WHERE ca.maCa=@2 AND (@0='QuanLy' OR EXISTS (
          SELECT 1 FROM PhanCongCa pc WHERE pc.maCa=ca.maCa AND pc.maNhanSu=@1))`, params);
        if (!rows.length) break;
        const ca = rows[0];
        ketQua.tieuDe = `Ca ${this.text(ca.maCa)}`;
        ketQua.thongTin = [this.muc('Ngày làm',ca.ngayLam),this.muc('Bắt đầu',ca.batDau),
          this.muc('Kết thúc',ca.ketThuc),this.muc('Trạng thái',ca.trangThai)];
        const phanCong: Array<{ viTri: string; hoTen: string; loaiNhanSu: string }> = await this.dataSource.query(`
          SELECT pc.viTri,ns.hoTen,ns.loaiNhanSu
          FROM PhanCongCa pc JOIN NhanSu ns ON ns.maNhanSu=pc.maNhanSu
          WHERE pc.maCa=@0 ORDER BY CASE pc.viTri WHEN N'Trưởng ca' THEN 0
          WHEN N'Pha chế' THEN 1 WHEN N'Thu ngân' THEN 2 ELSE 3 END`,[ma]);
        ketQua.noiDung = phanCong.map(p => ({ tieuDe:p.viTri,moTa:`${p.hoTen} · ${p.loaiNhanSu}` }));
        ketQua.ghiChu = 'Bảng phân công hiện tại không lưu lịch sử từng lần sửa phân công. Đây là danh sách nhân sự đang được lưu cho ca.';
        break;
      }
      case 'Checklist': {
        rows = await this.dataSource.query(`
          SELECT lk.maLan,lk.trangThai,CONVERT(VARCHAR(19),lk.thoiGianHoanTat,120) AS thoiGianHoanTat,
          pc.maCa,pc.viTri,ds.tenDanhSach,ns.hoTen
          FROM LanKiemTra lk JOIN DanhSachKiemTra ds ON ds.maDanhSach=lk.maDanhSach
          JOIN PhanCongCa pc ON pc.maPhanCong=lk.maPhanCong
          JOIN NhanSu ns ON ns.maNhanSu=pc.maNhanSu
          WHERE lk.maLan=@2 AND (@0='QuanLy' OR pc.maNhanSu=@1)`,params);
        if (!rows.length) break;
        const lk = rows[0];
        ketQua.tieuDe = this.text(lk.tenDanhSach);
        ketQua.thongTin = [this.muc('Mã lần kiểm tra',lk.maLan),this.muc('Ca làm việc',lk.maCa),
          this.muc('Nhân viên thực hiện',lk.hoTen),this.muc('Vị trí',lk.viTri),
          this.muc('Hoàn tất lúc',lk.thoiGianHoanTat),this.muc('Trạng thái',lk.trangThai)];
        const mucKiemTra: Array<{ noiDung: string; ketQua: string; ghiChu: string | null }> = await this.dataSource.query(`
          SELECT nd.noiDung,kq.ketQua,kq.ghiChu
          FROM KetQuaKiemTra kq JOIN NoiDungKiemTra nd ON nd.maNoiDung=kq.maNoiDung
          WHERE kq.maLan=@0 ORDER BY nd.thuTu,nd.maNoiDung`,[ma]);
        ketQua.noiDung = mucKiemTra.map(k => ({ tieuDe:k.noiDung,moTa:k.ghiChu ?? '',trangThai:k.ketQua }));
        break;
      }
      case 'SuCo': {
        rows = await this.dataSource.query(`
          SELECT sc.maSuCo,sc.maCa,sc.noiDung,sc.mucDo,sc.trangThai,sc.canBanGiaoCaSau,
          sc.viTriPhatSinh,CONVERT(VARCHAR(19),sc.thoiGianPhatSinh,120) AS thoiGianPhatSinh,
          CONVERT(VARCHAR(19),sc.thoiGianGhiNhan,120) AS thoiGianGhiNhan,
          sc.bienPhapBanDau,ns.hoTen
          FROM SuCo sc JOIN NhanSu ns ON ns.maNhanSu=sc.maNhanSuBaoCao
          WHERE sc.maSuCo=@2 AND (@0='QuanLy' OR EXISTS (
          SELECT 1 FROM PhanCongCa pc WHERE pc.maCa=sc.maCa AND pc.maNhanSu=@1))`,params);
        if (!rows.length) break;
        const sc = rows[0];
        ketQua.tieuDe = `Sự cố ${ma}`;
        ketQua.thongTin = [this.muc('Ca làm việc',sc.maCa),this.muc('Người báo cáo',sc.hoTen),
          this.muc('Vị trí phát sinh',sc.viTriPhatSinh),this.muc('Mức độ',sc.mucDo),
          this.muc('Phát sinh lúc',sc.thoiGianPhatSinh),this.muc('Ghi nhận lúc',sc.thoiGianGhiNhan),
          this.muc('Trạng thái',sc.trangThai),this.muc('Bàn giao ca sau',Number(sc.canBanGiaoCaSau)===1?'Có':'Không')];
        ketQua.noiDung = [{tieuDe:'Mô tả sự cố',moTa:this.text(sc.noiDung)},
          {tieuDe:'Biện pháp ban đầu',moTa:this.text(sc.bienPhapBanDau)}];
        const lichSu: Array<{ thoiGian: string; nguoi: string; noiDung: string; trangThai: string }> =
          await this.dataSource.query(`
            SELECT CONVERT(VARCHAR(19),ls.thoiGianCapNhat,120) AS thoiGian,
            tk.tenDangNhap AS nguoi,ls.noiDungXuLy AS noiDung,ls.trangThaiSau AS trangThai
            FROM LichSuXuLySuCo ls JOIN TaiKhoan tk ON tk.maTaiKhoan=ls.maTaiKhoanCapNhat
            WHERE ls.maSuCo=@0 ORDER BY ls.thoiGianCapNhat DESC,ls.maCapNhat DESC`,[ma]);
        ketQua.dienBien = lichSu;
        break;
      }
      case 'BanGiaoViTri': {
        rows = await this.dataSource.query(`
          SELECT bg.maBanGiao,bg.maLanKiemTra,bg.trangThaiTiepNhan,bg.ghiChu,
          CONVERT(VARCHAR(19),bg.thoiGianTiepNhan,120) AS thoiGianTiepNhan,
          pcGiao.maCa AS maCaGiao,pcNhan.maCa AS maCaNhan,pcNhan.viTri,
          nsGiao.hoTen AS tenGiao,nsNhan.hoTen AS tenNhan
          FROM BanGiaoTheoViTri bg
          JOIN PhanCongCa pcGiao ON pcGiao.maPhanCong=bg.maPhanCongGiao
          JOIN PhanCongCa pcNhan ON pcNhan.maPhanCong=bg.maPhanCongNhan
          JOIN NhanSu nsGiao ON nsGiao.maNhanSu=pcGiao.maNhanSu
          JOIN NhanSu nsNhan ON nsNhan.maNhanSu=pcNhan.maNhanSu
          WHERE bg.maBanGiao=@2 AND (@0='QuanLy' OR pcGiao.maNhanSu=@1 OR pcNhan.maNhanSu=@1)`,params);
        if (!rows.length) break;
        const bg = rows[0];
        ketQua.tieuDe = `Bàn giao vị trí ${this.text(bg.viTri)}`;
        ketQua.thongTin = [this.muc('Ca bàn giao',bg.maCaGiao),this.muc('Ca tiếp nhận',bg.maCaNhan),
          this.muc('Người bàn giao',bg.tenGiao),this.muc('Người tiếp nhận',bg.tenNhan),
          this.muc('Vị trí',bg.viTri),this.muc('Checklist tham chiếu',bg.maLanKiemTra),
          this.muc('Trạng thái',bg.trangThaiTiepNhan),this.muc('Thời gian xác nhận',bg.thoiGianTiepNhan)];
        ketQua.noiDung = [{tieuDe:'Ghi chú tiếp nhận',moTa:this.text(bg.ghiChu)}];
        break;
      }
      case 'DoiCa': {
        rows = await this.dataSource.query(`
          SELECT yc.maYeuCau,yc.maCaDeXuat,yc.lyDo,yc.lyDoTuChoi,yc.trangThai,
          CONVERT(VARCHAR(19),yc.thoiGianGui,120) AS thoiGianGui,
          CONVERT(VARCHAR(19),yc.thoiGianXuLy,120) AS thoiGianXuLy,
          pc.maCa AS maCaGoc,ns.hoTen,tk.tenDangNhap AS nguoiDuyet
          FROM YeuCauDoiCa yc JOIN PhanCongCa pc ON pc.maPhanCong=yc.maPhanCongGoc
          JOIN NhanSu ns ON ns.maNhanSu=yc.maNhanSuGui
          LEFT JOIN TaiKhoan tk ON tk.maTaiKhoan=yc.maTaiKhoanDuyet
          WHERE yc.maYeuCau=@2 AND (@0='QuanLy' OR yc.maNhanSuGui=@1)`,params);
        if (!rows.length) break;
        const yc = rows[0];
        ketQua.tieuDe = `Yêu cầu đổi ca ${ma}`;
        ketQua.thongTin = [this.muc('Người gửi',yc.hoTen),this.muc('Ca gốc',yc.maCaGoc),
          this.muc('Ca đề xuất',yc.maCaDeXuat),this.muc('Trạng thái',yc.trangThai),
          this.muc('Thời gian gửi',yc.thoiGianGui),this.muc('Người duyệt',yc.nguoiDuyet),
          this.muc('Thời gian xử lý',yc.thoiGianXuLy)];
        ketQua.noiDung = [{tieuDe:'Lý do đổi ca',moTa:this.text(yc.lyDo)}];
        if (yc.lyDoTuChoi) ketQua.noiDung.push({tieuDe:'Lý do từ chối',moTa:this.text(yc.lyDoTuChoi)});
        break;
      }
      case 'BienBanCa': {
        rows = await this.dataSource.query(`
          SELECT bb.maBienBan,bb.maCaBanGiao,bb.maCaTiepNhan,bb.tongKetVanHanh,
          bb.noiDungTonDong,bb.trangThai,
          CONVERT(VARCHAR(19),bb.thoiGianLap,120) AS thoiGianLap,
          CONVERT(VARCHAR(19),bb.thoiGianTiepNhan,120) AS thoiGianTiepNhan,
          nsGiao.hoTen AS tenGiao,nsNhan.hoTen AS tenNhan
          FROM BienBanBanGiaoCa bb
          JOIN PhanCongCa pcGiao ON pcGiao.maPhanCong=bb.maPhanCongGiao
          JOIN PhanCongCa pcNhan ON pcNhan.maPhanCong=bb.maPhanCongNhan
          JOIN NhanSu nsGiao ON nsGiao.maNhanSu=pcGiao.maNhanSu
          JOIN NhanSu nsNhan ON nsNhan.maNhanSu=pcNhan.maNhanSu
          WHERE bb.maBienBan=@2 AND (@0='QuanLy' OR pcGiao.maNhanSu=@1 OR pcNhan.maNhanSu=@1)`,params);
        if (!rows.length) break;
        const bb = rows[0];
        ketQua.tieuDe = `Biên bản bàn giao ${ma}`;
        ketQua.thongTin = [this.muc('Ca bàn giao',bb.maCaBanGiao),this.muc('Ca tiếp nhận',bb.maCaTiepNhan),
          this.muc('Trưởng ca giao',bb.tenGiao),this.muc('Trưởng ca nhận',bb.tenNhan),
          this.muc('Thời gian lập',bb.thoiGianLap),this.muc('Thời gian nhận',bb.thoiGianTiepNhan),
          this.muc('Trạng thái',bb.trangThai)];
        ketQua.noiDung = [{tieuDe:'Tổng kết vận hành',moTa:this.text(bb.tongKetVanHanh)},
          {tieuDe:'Nội dung tồn đọng',moTa:this.text(bb.noiDungTonDong)}];
        break;
      }
    }
    if (!rows.length) throw new NotFoundException('Không tìm thấy dữ liệu hoặc bạn không có quyền truy cập');
    return ketQua;
  }
}
