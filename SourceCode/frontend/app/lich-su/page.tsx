"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { keycloak, khoiTaoKeycloak } from "../../lib/keycloak";
import { layAccessToken } from "../../lib/auth-api";

const API = "http://localhost:3001";

const nhomDuLieu = [
  { ma: "Ca", ten: "Ca làm việc" },
  { ma: "Checklist", ten: "Checklist" },
  { ma: "SuCo", ten: "Sự cố" },
  { ma: "BanGiaoViTri", ten: "Bàn giao vị trí" },
  { ma: "DoiCa", ten: "Đổi ca" },
  { ma: "BienBanCa", ten: "Biên bản bàn giao ca" },
] as const;

type Loai = (typeof nhomDuLieu)[number]["ma"];
type BanGhi = {
  ma: string;
  maCa: string;
  ngay: string | null;
  tieuDe: string;
  moTa: string;
  trangThai: string;
};
type ChiTiet = {
  tieuDe: string;
  thongTin: Array<{ ten: string; giaTri: string }>;
  noiDung: Array<{ tieuDe: string; moTa: string; trangThai?: string }>;
  dienBien: Array<{ thoiGian: string; nguoi: string; noiDung: string; trangThai: string }>;
  ghiChu?: string;
};
type DuLieu = { loai: Loai; vaiTro: string; danhSach: BanGhi[]; gioiHan: number };

type BoLoc = { tuNgay: string; denNgay: string; tuKhoa: string };

function docLoi(body: unknown, status: number): string {
  if (body && typeof body === "object" && "message" in body) {
    const msg = (body as { message: string | string[] }).message;
    if (typeof msg === "string") return msg;
    if (Array.isArray(msg)) return msg.join("; ");
  }
  return `Không thể kết nối hệ thống (HTTP ${status}).`;
}

function dinhDangNgay(value: string | null | undefined): string {
  if (!value) return "Chưa ghi nhận thời gian";
  const [nam, thang, ngay] = value.slice(0, 10).split("-");
  if (!ngay || !thang || !nam) return value;
  const gio = value.length >= 16 ? ` · ${value.slice(11, 16)}` : "";
  return `${ngay}/${thang}/${nam}${gio}`;
}

function nhanTrangThai(value: string): string {
  const bang: Record<string, string> = {
    ChuaPhanCong: "Chưa phân công",
    DaPhanCong: "Đã phân công",
    DangDienRa: "Đang diễn ra",
    ChoBanGiao: "Chờ bàn giao",
    DaKetThuc: "Đã kết thúc",
    DaHoanTat: "Đã hoàn tất",
    ChoXetDuyet: "Chờ xét duyệt",
    DaChapThuan: "Đã chấp thuận",
    DaTuChoi: "Đã từ chối",
    DaTiepNhan: "Đã tiếp nhận",
    CanBoSung: "Cần bổ sung",
    ChoTiepNhan: "Chờ tiếp nhận",
    ChuaHoanThanh: "Chưa hoàn thành",
    DangXuLy: "Đang xử lý",
    DaXuLy: "Đã xử lý",
    Dat: "Đạt",
    KhongDat: "Không đạt",
  };
  return bang[value] ?? value;
}

function mauTrangThai(value: string) {
  if (["DaHoanTat", "DaKetThuc", "DaChapThuan", "DaTiepNhan", "DaXuLy", "Dat"].includes(value)) {
    return "bg-[#e9f4e8] text-[#38613b]";
  }
  if (["DaTuChoi", "KhongDat"].includes(value)) {
    return "bg-red-50 text-red-700";
  }
  return "bg-[#f7f0dd] text-[#80652c]";
}

export default function LichSuPage() {
  const [dangTai, setDangTai] = useState(true);
  const [daDangNhap, setDaDangNhap] = useState(false);
  const [dangTim, setDangTim] = useState(false);
  const [dangTaiChiTiet, setDangTaiChiTiet] = useState(false);
  const [loai, setLoai] = useState<Loai>("Ca");
  const [boLoc, setBoLoc] = useState<BoLoc>({ tuNgay: "", denNgay: "", tuKhoa: "" });
  const [duLieu, setDuLieu] = useState<DuLieu | null>(null);
  const [maDangXem, setMaDangXem] = useState("");
  const [chiTiet, setChiTiet] = useState<ChiTiet | null>(null);
  const [loi, setLoi] = useState("");
  const [loiChiTiet, setLoiChiTiet] = useState("");

  async function napDanhSach(nhom: Loai, loc: BoLoc): Promise<DuLieu> {
    const token = await layAccessToken();
    const params = new URLSearchParams({ loai: nhom });
    if (loc.tuNgay) params.set("tuNgay", loc.tuNgay);
    if (loc.denNgay) params.set("denNgay", loc.denNgay);
    if (loc.tuKhoa.trim()) params.set("tuKhoa", loc.tuKhoa.trim());
    const response = await fetch(`${API}/lich-su/tim-kiem?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const body: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(docLoi(body, response.status));
    return body as DuLieu;
  }

  useEffect(() => {
    let hoatDong = true;
    async function khoiTao() {
      try {
        const authenticated = await khoiTaoKeycloak();
        if (!hoatDong) return;
        setDaDangNhap(authenticated);
        if (!authenticated) return;
        const data = await napDanhSach("Ca", { tuNgay: "", denNgay: "", tuKhoa: "" });
        if (hoatDong) setDuLieu(data);
      } catch (error) {
        if (hoatDong) setLoi(error instanceof Error ? error.message : "Không tải được lịch sử");
      } finally {
        if (hoatDong) setDangTai(false);
      }
    }
    void khoiTao();
    return () => { hoatDong = false; };
  }, []);

  useEffect(() => {
    let hoatDong = true;
    if (!maDangXem) {
      return () => { hoatDong = false; };
    }
    async function napChiTiet() {
      setDangTaiChiTiet(true);
      setLoiChiTiet("");
      setChiTiet(null);
      try {
        const token = await layAccessToken();
        const response = await fetch(`${API}/lich-su/chi-tiet/${loai}/${encodeURIComponent(maDangXem)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const body: unknown = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(docLoi(body, response.status));
        if (hoatDong) setChiTiet(body as ChiTiet);
      } catch (error) {
        if (hoatDong) setLoiChiTiet(error instanceof Error ? error.message : "Không xem được chi tiết");
      } finally {
        if (hoatDong) setDangTaiChiTiet(false);
      }
    }
    void napChiTiet();
    return () => { hoatDong = false; };
  }, [loai, maDangXem]);

  async function timKiem(nhom: Loai = loai, loc: BoLoc = boLoc) {
    setLoai(nhom);
    setMaDangXem("");
    setChiTiet(null);
    setLoi("");
    setLoiChiTiet("");
    if (loc.tuNgay && loc.denNgay && loc.tuNgay > loc.denNgay) {
      setLoi("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
      return;
    }
    setDangTim(true);
    setDuLieu(null);
    try {
      const data = await napDanhSach(nhom, loc);
      setDuLieu(data);
    } catch (error) {
      setLoi(error instanceof Error ? error.message : "Không thể tìm kiếm lịch sử");
    } finally {
      setDangTim(false);
    }
  }

  function doiLoai(nhom: Loai) {
    if (nhom === loai) return;
    void timKiem(nhom);
  }

  function xoaBoLoc() {
    const moi = { tuNgay: "", denNgay: "", tuKhoa: "" };
    setBoLoc(moi);
    void timKiem(loai, moi);
  }

  async function dangNhap() {
    try {
      await khoiTaoKeycloak();
      await keycloak.login({ redirectUri: `${window.location.origin}/lich-su` });
    } catch {
      setLoi("Không thể chuyển đến trang đăng nhập.");
    }
  }

  const soBanGhi = duLieu?.danhSach.length ?? 0;
  const tenLoai = nhomDuLieu.find((nhom) => nhom.ma === loai)?.ten ?? "Lịch sử";

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#849386]">DỮ LIỆU VẬN HÀNH</p>
          <h1 className="text-3xl font-semibold text-[#30483a]">Tra cứu lịch sử</h1>
          <p className="mt-2 text-sm text-[#748477]">Tra cứu ca làm việc, Checklist, sự cố và kết quả bàn giao đã lưu trong hệ thống.</p>
        </div>
        <Link href="/lich-lam-viec" className="rounded-lg border border-[#d6e0d5] bg-white px-4 py-2.5 text-sm text-[#30483a] hover:bg-[#f8faf7]">
          Xem lịch làm việc
        </Link>
      </div>

      {loi && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loi}</p>}

      {dangTai ? (
        <section className="rounded-xl border border-[#e2e9e0] bg-white p-7 text-sm text-[#748477]">Đang kiểm tra tài khoản...</section>
      ) : !daDangNhap ? (
        <section className="rounded-xl border border-[#e2e9e0] bg-white p-7">
          <p className="mb-4 text-sm text-[#748477]">Bạn cần đăng nhập để tra cứu dữ liệu trong phạm vi được phép.</p>
          <button type="button" onClick={() => void dangNhap()} className="rounded-lg bg-[#30483a] px-5 py-3 text-sm font-semibold text-white">Đăng nhập</button>
        </section>
      ) : (
        <>
          <section className="overflow-hidden rounded-xl border border-[#e2e9e0] bg-white">
            <div className="border-b border-[#e9eee7] px-5 py-5 md:px-6">
              <h2 className="text-lg font-semibold text-[#30483a]">Nhóm dữ liệu</h2>
              <p className="mt-1 text-sm text-[#748477]">{duLieu?.vaiTro === "QuanLy" ? "Quản lý xem dữ liệu toàn cửa hàng." : "Nhân viên chỉ xem dữ liệu liên quan đến mình hoặc ca được phân công."}</p>
            </div>
            <div className="flex flex-wrap gap-2 px-5 py-4 md:px-6">
              {nhomDuLieu.map((nhom) => (
                <button key={nhom.ma} type="button" onClick={() => doiLoai(nhom.ma)} disabled={dangTim}
                  className={`rounded-lg border px-3 py-2.5 text-sm transition-colors disabled:opacity-50 ${loai === nhom.ma ? "border-[#30483a] bg-[#30483a] font-semibold text-white" : "border-[#dce5da] bg-white text-[#526655] hover:bg-[#f4f7f2]"}`}>
                  {nhom.ten}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[#e2e9e0] bg-white p-5 md:p-6">
            <h2 className="text-lg font-semibold text-[#30483a]">Bộ lọc tìm kiếm</h2>
            <form onSubmit={(event) => { event.preventDefault(); void timKiem(); }} className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_1.5fr_auto] md:items-end">
              <div>
                <label htmlFor="tu-ngay" className="mb-2 block text-sm font-medium text-[#445949]">Từ ngày</label>
                <input id="tu-ngay" type="date" value={boLoc.tuNgay} onChange={(event) => setBoLoc((p) => ({ ...p, tuNgay: event.target.value }))}
                  className="w-full rounded-lg border border-[#dce5da] bg-white px-3 py-2.5 text-sm text-[#30483a]" />
              </div>
              <div>
                <label htmlFor="den-ngay" className="mb-2 block text-sm font-medium text-[#445949]">Đến ngày</label>
                <input id="den-ngay" type="date" value={boLoc.denNgay} onChange={(event) => setBoLoc((p) => ({ ...p, denNgay: event.target.value }))}
                  className="w-full rounded-lg border border-[#dce5da] bg-white px-3 py-2.5 text-sm text-[#30483a]" />
              </div>
              <div>
                <label htmlFor="tu-khoa" className="mb-2 block text-sm font-medium text-[#445949]">Ca / nhân viên / từ khóa</label>
                <input id="tu-khoa" maxLength={100} value={boLoc.tuKhoa} onChange={(event) => setBoLoc((p) => ({ ...p, tuKhoa: event.target.value }))}
                  placeholder="Nhập mã ca, tên nhân viên hoặc nội dung..."
                  className="w-full rounded-lg border border-[#dce5da] bg-white px-3 py-2.5 text-sm text-[#30483a] placeholder:text-[#a0aea1]" />
              </div>
              <button type="submit" disabled={dangTim} className="rounded-lg bg-[#30483a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#45664d] disabled:opacity-50">
                {dangTim ? "Đang tìm..." : "Tìm kiếm"}
              </button>
            </form>
            <button type="button" onClick={xoaBoLoc} disabled={dangTim} className="mt-3 text-sm text-[#607663] underline underline-offset-4 disabled:opacity-50">Xóa bộ lọc, xem dữ liệu gần nhất</button>
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)]">
            <section className="self-start overflow-hidden rounded-xl border border-[#e2e9e0] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9eee7] px-5 py-4 md:px-6">
                <div>
                  <h2 className="font-semibold text-[#30483a]">{tenLoai}</h2>
                  <p className="mt-1 text-xs text-[#859287]">{dangTim ? "Đang tải danh sách..." : `${soBanGhi} kết quả · Tối đa 100 bản ghi gần nhất`}</p>
                </div>
              </div>
              {dangTim ? (
                <p className="p-6 text-sm text-[#748477]">Đang tìm dữ liệu...</p>
              ) : soBanGhi === 0 ? (
                <div className="space-y-2 p-6 text-sm text-[#748477]">
                  <p>Không có bản ghi phù hợp trong phạm vi được phép.</p>
                  {loai === "BienBanCa" && <p>Biên bản bàn giao giữa hai Trưởng ca chưa được triển khai trong các bước trước, nên nhóm này có thể chưa có dữ liệu.</p>}
                </div>
              ) : (
                <div className="max-h-[680px] divide-y divide-[#edf1eb] overflow-y-auto">
                  {duLieu?.danhSach.map((item) => (
                    <button key={item.ma} type="button" onClick={() => setMaDangXem(item.ma)}
                      className={`w-full p-5 text-left transition-colors hover:bg-[#f5f8f3] ${maDangXem === item.ma ? "bg-[#edf3e9]" : "bg-white"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-semibold text-[#30483a]">{item.tieuDe}</p>
                        <span className={`rounded-full px-2.5 py-1 text-xs ${mauTrangThai(item.trangThai)}`}>{nhanTrangThai(item.trangThai)}</span>
                      </div>
                      <p className="mt-2 text-sm text-[#526655]">{item.moTa}</p>
                      <p className="mt-2 text-xs text-[#839084]">{item.maCa} · {dinhDangNgay(item.ngay)}</p>
                      <p className="mt-1 text-xs text-[#93a093]">Mã: {item.ma}</p>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="self-start overflow-hidden rounded-xl border border-[#e2e9e0] bg-white">
              <div className="border-b border-[#e9eee7] bg-[#edf3e9] px-5 py-4 md:px-6">
                <h2 className="font-semibold text-[#30483a]">Chi tiết lịch sử</h2>
                <p className="mt-1 text-xs text-[#657967]">Chọn một bản ghi ở danh sách bên trái để xem nội dung đã lưu.</p>
              </div>
              {!maDangXem ? (
                <p className="p-6 text-sm text-[#748477]">Chưa chọn bản ghi.</p>
              ) : dangTaiChiTiet ? (
                <p className="p-6 text-sm text-[#748477]">Đang tải chi tiết...</p>
              ) : loiChiTiet ? (
                <p role="alert" className="p-6 text-sm text-red-700">{loiChiTiet}</p>
              ) : chiTiet ? (
                <div className="space-y-6 p-5 md:p-6">
                  <h3 className="text-lg font-semibold text-[#30483a]">{chiTiet.tieuDe}</h3>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {chiTiet.thongTin.map((item, index) => (
                      <div key={`${item.ten}-${index}`} className="rounded-lg bg-[#f4f7f2] p-3">
                        <dt className="text-xs text-[#7c8d7e]">{item.ten}</dt>
                        <dd className="mt-1 break-words text-sm font-medium text-[#30483a]">{item.giaTri}</dd>
                      </div>
                    ))}
                  </dl>
                  {chiTiet.noiDung.length > 0 && (
                    <div>
                      <h4 className="mb-3 font-semibold text-[#30483a]">Nội dung chi tiết</h4>
                      <div className="divide-y divide-[#edf1eb] rounded-lg border border-[#e2e9e0]">
                        {chiTiet.noiDung.map((item, index) => (
                          <div key={index} className="space-y-2 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-[#30483a]">{item.tieuDe}</p>
                              {item.trangThai && <span className={`rounded-full px-2.5 py-1 text-xs ${mauTrangThai(item.trangThai)}`}>{nhanTrangThai(item.trangThai)}</span>}
                            </div>
                            {item.moTa && <p className="whitespace-pre-wrap text-sm leading-6 text-[#637765]">{item.moTa}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {chiTiet.dienBien.length > 0 && (
                    <div>
                      <h4 className="mb-3 font-semibold text-[#30483a]">Lịch sử cập nhật xử lý</h4>
                      <div className="space-y-3">
                        {chiTiet.dienBien.map((item, index) => (
                          <div key={index} className="rounded-lg border border-[#e2e9e0] p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-medium text-[#30483a]">{item.nguoi}</span>
                              <span className={`rounded-full px-2.5 py-1 text-xs ${mauTrangThai(item.trangThai)}`}>{nhanTrangThai(item.trangThai)}</span>
                            </div>
                            <p className="mt-2 text-xs text-[#839084]">{dinhDangNgay(item.thoiGian)}</p>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-[#526655]">{item.noiDung}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {chiTiet.ghiChu && <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{chiTiet.ghiChu}</p>}
                </div>
              ) : (
                <p className="p-6 text-sm text-[#748477]">Không có dữ liệu chi tiết.</p>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
