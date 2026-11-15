"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { keycloak, khoiTaoKeycloak } from "../../lib/keycloak";
import { layAccessToken } from "../../lib/auth-api";

const API = "http://localhost:3001";

type ThongKe = {
  caHomNay: number;
  caDaPhanCong: number;
  nhanSuHomNay: number;
  yeuCauChoDuyet: number;
  suCoChuaXuLy: number;
  checklistDaHoanTat: number;
  bienBanChoTiepNhan: number;
};

type CaHomNay = {
  maCa: string;
  ngayLam: string;
  gioBatDau: string;
  gioKetThuc: string;
  trangThai: string;
  soNhanVien: number;
  truongCa: string | null;
  viTriCuaToi: string | null;
  dangDienRa: number;
};

type CaSapToi = {
  maCa: string;
  ngayLam: string;
  gioBatDau: string;
  gioKetThuc: string;
  trangThai: string;
  viTriCuaToi: string | null;
};

type SuCo = {
  maSuCo: string;
  maCa: string;
  noiDung: string;
  mucDo: string;
  trangThai: string;
  canBanGiaoCaSau: number | boolean;
  ngayLam: string;
};

type YeuCau = {
  maYeuCau: string;
  trangThai: string;
  nguoiGui: string;
  maCa: string;
  ngayLam: string;
  thoiGianGui: string;
};

type DuLieu = {
  vaiTro: "QuanLy" | "NhanVien";
  hoTen: string;
  maNhanSu: string;
  ngayHienTai: string;
  gioHienTai: string;
  thongKe: ThongKe;
  caHomNay: CaHomNay[];
  caSapToi: CaSapToi[];
  suCoCanChuY: SuCo[];
  yeuCauGanDay: YeuCau[];
};

function ngayVN(value: string | null | undefined) {
  if (!value) return "—";
  const parts = value.slice(0, 10).split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}

function trangThaiVN(value: string) {
  const status: Record<string, string> = {
    ChuaPhanCong: "Chưa phân công",
    DaPhanCong: "Đã phân công",
    DangDienRa: "Đang diễn ra",
    ChoBanGiao: "Chờ bàn giao",
    DaKetThuc: "Đã kết thúc",
    ChoXetDuyet: "Chờ xét duyệt",
    DaChapThuan: "Đã chấp thuận",
    DaTuChoi: "Đã từ chối",
    ChuaHoanThanh: "Chưa hoàn thành",
    DangXuLy: "Đang xử lý",
    DaXuLy: "Đã xử lý",
  };
  return status[value] ?? value;
}

function loiHTTP(body: unknown, code: number) {
  if (body && typeof body === "object" && "message" in body) {
    const msg = (body as { message?: string | string[] }).message;
    if (typeof msg === "string") return msg;
    if (Array.isArray(msg)) return msg.join("; ");
  }
  return `Không thể tải Tổng quan (HTTP ${code}).`;
}

function TheSo({ label, value, moTa, href, kyHieu }: {
  label: string;
  value: number;
  moTa: string;
  href: string;
  kyHieu: string;
}) {
  return (
    <Link href={href} className="group rounded-xl border border-[#dfe7dc] bg-white p-5 transition-colors hover:border-[#aac1aa] hover:bg-[#fbfcfa]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#617364]">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#edf3e9] text-lg text-[#537358]">{kyHieu}</span>
      </div>
      <p className="mt-4 text-3xl font-semibold text-[#30483a]">{value}</p>
      <p className="mt-1 text-xs text-[#8b9a8c]">{moTa}</p>
    </Link>
  );
}

export default function TongQuanPage() {
  const [dangTai, setDangTai] = useState(true);
  const [daDangNhap, setDaDangNhap] = useState(false);
  const [duLieu, setDuLieu] = useState<DuLieu | null>(null);
  const [loi, setLoi] = useState("");
  const [dangNapLai, setDangNapLai] = useState(false);

  async function napDuLieu() {
    const token = await layAccessToken();
    const response = await fetch(`${API}/tong-quan/du-lieu`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    const body: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(loiHTTP(body, response.status));
    return body as DuLieu;
  }

  useEffect(() => {
    let conHoatDong = true;

    async function khoiTao() {
      try {
        const authenticated = await khoiTaoKeycloak();
        if (!conHoatDong) return;
        setDaDangNhap(authenticated);
        if (!authenticated) return;
        const data = await napDuLieu();
        if (conHoatDong) setDuLieu(data);
      } catch (error) {
        if (conHoatDong) setLoi(error instanceof Error ? error.message : "Không thể kết nối hệ thống.");
      } finally {
        if (conHoatDong) setDangTai(false);
      }
    }

    void khoiTao();
    return () => { conHoatDong = false; };
  }, []);

  async function taiLai() {
    setDangNapLai(true);
    setLoi("");
    try {
      const data = await napDuLieu();
      setDuLieu(data);
    } catch (error) {
      setLoi(error instanceof Error ? error.message : "Không thể tải lại dữ liệu.");
    } finally {
      setDangNapLai(false);
    }
  }

  async function dangNhap() {
    try {
      await khoiTaoKeycloak();
      await keycloak.login({ redirectUri: `${window.location.origin}/tong-quan` });
    } catch {
      setLoi("Không thể chuyển đến trang đăng nhập.");
    }
  }

  const laQuanLy = duLieu?.vaiTro === "QuanLy";
  const t = duLieu?.thongKe;

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#849386]">ĐIỀU PHỐI VẬN HÀNH</p>
          <h1 className="text-3xl font-semibold text-[#30483a]">Tổng quan</h1>
          <p className="mt-2 text-sm text-[#738475]">{duLieu ? `Xin chào ${duLieu.hoTen}. Dữ liệu hệ thống ngày ${ngayVN(duLieu.ngayHienTai)}.` : "Theo dõi hoạt động của cửa hàng theo quyền truy cập."}</p>
        </div>
        {duLieu && <button type="button" onClick={() => void taiLai()} disabled={dangNapLai} className="rounded-lg border border-[#d8e2d7] bg-white px-4 py-2.5 text-sm font-medium text-[#30483a] hover:bg-[#f8faf7] disabled:opacity-50">{dangNapLai ? "Đang cập nhật..." : "Làm mới dữ liệu"}</button>}
      </div>

      {loi && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loi}</div>}

      {dangTai ? (
        <section className="rounded-xl border border-[#dfe7dc] bg-white p-7 text-sm text-[#748477]">Đang tải thông tin Tổng quan...</section>
      ) : !daDangNhap ? (
        <section className="rounded-xl border border-[#dfe7dc] bg-white p-7">
          <p className="mb-4 text-sm text-[#738475]">Bạn cần đăng nhập để xem số liệu vận hành.</p>
          <button type="button" onClick={() => void dangNhap()} className="rounded-lg bg-[#30483a] px-5 py-3 text-sm font-semibold text-white">Đăng nhập</button>
        </section>
      ) : duLieu ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <TheSo label={laQuanLy ? "Ca làm việc hôm nay" : "Ca của tôi hôm nay"} value={t?.caHomNay ?? 0} moTa={laQuanLy ? "Toàn bộ ca trong ngày" : "Ca được phân công cho bạn"} href="/lich-lam-viec" kyHieu="▤" />
            {laQuanLy ? (
              <TheSo label="Ca đã phân công" value={t?.caDaPhanCong ?? 0} moTa="Đủ 4 nhân sự trong ca hôm nay" href="/phan-cong-ca" kyHieu="◫" />
            ) : (
              <TheSo label="Checklist hoàn tất" value={t?.checklistDaHoanTat ?? 0} moTa="Số lần kiểm tra của bạn hôm nay" href="/checklist" kyHieu="☑" />
            )}
            <TheSo label={laQuanLy ? "Yêu cầu chờ duyệt" : "Yêu cầu đổi ca chờ duyệt"} value={t?.yeuCauChoDuyet ?? 0} moTa="Yêu cầu hiện chưa được xử lý" href={laQuanLy ? "/xu-ly-doi-ca" : "/yeu-cau-doi-ca"} kyHieu="⇄" />
            <TheSo label="Sự cố chưa xử lý xong" value={t?.suCoChuaXuLy ?? 0} moTa={laQuanLy ? "Toàn cửa hàng" : "Trong các ca của bạn"} href="/su-co" kyHieu="⚑" />
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-[#dfe7dc] bg-[#f8faf6] p-5">
              <p className="text-sm text-[#617364]">{laQuanLy ? "Nhân sự tham gia hôm nay" : "Nhân sự của tôi hôm nay"}</p>
              <p className="mt-2 text-2xl font-semibold text-[#30483a]">{t?.nhanSuHomNay ?? 0}</p>
              <p className="mt-1 text-xs text-[#8b9a8c]">Tính theo các phân công của ngày hiện tại</p>
            </div>
            {laQuanLy && <div className="rounded-xl border border-[#dfe7dc] bg-[#f8faf6] p-5">
              <p className="text-sm text-[#617364]">Checklist hoàn tất hôm nay</p>
              <p className="mt-2 text-2xl font-semibold text-[#30483a]">{t?.checklistDaHoanTat ?? 0}</p>
              <p className="mt-1 text-xs text-[#8b9a8c]">Mỗi lần hoàn tất được tính một bản ghi</p>
            </div>}
            <div className="rounded-xl border border-[#dfe7dc] bg-[#f8faf6] p-5">
              <p className="text-sm text-[#617364]">Biên bản chờ tiếp nhận</p>
              <p className="mt-2 text-2xl font-semibold text-[#30483a]">{t?.bienBanChoTiepNhan ?? 0}</p>
              <Link href="/ban-giao" className="mt-1 inline-block text-xs font-medium text-[#56775b] hover:underline">Xem bàn giao ca</Link>
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <section className="overflow-hidden rounded-xl border border-[#dfe7dc] bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-[#e8eee6] px-5 py-4">
                <h2 className="font-semibold text-[#30483a]">{laQuanLy ? "Ca làm việc hôm nay" : "Lịch của tôi hôm nay"}</h2>
                <Link href="/lich-lam-viec" className="text-xs font-medium text-[#507355] hover:underline">Xem lịch</Link>
              </div>
              {duLieu.caHomNay.length === 0 ? (
                <p className="p-5 text-sm text-[#859287]">{laQuanLy ? "Hôm nay chưa có ca làm việc." : "Bạn chưa được phân công ca hôm nay."}</p>
              ) : (
                <div className="divide-y divide-[#edf1eb]">
                  {duLieu.caHomNay.map((ca) => (
                    <div key={ca.maCa} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <div>
                        <p className="font-medium text-[#30483a]">{ca.gioBatDau}–{ca.gioKetThuc} · {ca.maCa}</p>
                        <p className="mt-1 text-xs text-[#758779]">{laQuanLy ? `${ca.soNhanVien}/4 người · Trưởng ca: ${ca.truongCa ?? "Chưa phân công"}` : `Vị trí: ${ca.viTriCuaToi ?? "Chưa xác định"}`}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${Number(ca.dangDienRa) === 1 ? "bg-[#e8f4e8] text-[#37663d]" : "bg-[#f0f3ee] text-[#5e7162]"}`}>{Number(ca.dangDienRa) === 1 ? "Đang trong giờ ca" : trangThaiVN(ca.trangThai)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-xl border border-[#dfe7dc] bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-[#e8eee6] px-5 py-4">
                <h2 className="font-semibold text-[#30483a]">Ca sắp tới</h2>
                <Link href="/lich-lam-viec" className="text-xs font-medium text-[#507355] hover:underline">Chi tiết lịch</Link>
              </div>
              {duLieu.caSapToi.length === 0 ? <p className="p-5 text-sm text-[#859287]">Chưa có ca sắp tới trong phạm vi được xem.</p> : (
                <div className="divide-y divide-[#edf1eb]">
                  {duLieu.caSapToi.map((ca) => (
                    <div key={ca.maCa} className="px-5 py-3.5">
                      <p className="text-sm font-medium text-[#30483a]">{ngayVN(ca.ngayLam)} · {ca.gioBatDau}–{ca.gioKetThuc}</p>
                      <p className="mt-1 text-xs text-[#849586]">{ca.maCa}{ca.viTriCuaToi ? ` · ${ca.viTriCuaToi}` : ""}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="overflow-hidden rounded-xl border border-[#dfe7dc] bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-[#e8eee6] px-5 py-4">
                <h2 className="font-semibold text-[#30483a]">Sự cố cần chú ý</h2>
                <Link href="/su-co" className="text-xs font-medium text-[#507355] hover:underline">Xem sự cố</Link>
              </div>
              {duLieu.suCoCanChuY.length === 0 ? <p className="p-5 text-sm text-[#859287]">Không có sự cố chưa xử lý xong trong phạm vi của bạn.</p> : (
                <div className="divide-y divide-[#edf1eb]">
                  {duLieu.suCoCanChuY.map((sc) => (
                    <div key={sc.maSuCo} className="px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium text-[#768877]">{sc.maCa} · {ngayVN(sc.ngayLam)}</p>
                        <span className={`rounded-full px-2.5 py-1 text-xs ${sc.mucDo === "QuanTrong" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>{sc.mucDo === "QuanTrong" ? "Quan trọng" : "Thông thường"}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-[#30483a]">{sc.noiDung}</p>
                      <p className="mt-1 text-xs text-[#859287]">{trangThaiVN(sc.trangThai)}{Number(sc.canBanGiaoCaSau) === 1 ? " · Cần bàn giao ca sau" : ""}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-xl border border-[#dfe7dc] bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-[#e8eee6] px-5 py-4">
                <h2 className="font-semibold text-[#30483a]">Yêu cầu đổi ca gần đây</h2>
                <Link href={laQuanLy ? "/xu-ly-doi-ca" : "/yeu-cau-doi-ca"} className="text-xs font-medium text-[#507355] hover:underline">Xem yêu cầu</Link>
              </div>
              {duLieu.yeuCauGanDay.length === 0 ? <p className="p-5 text-sm text-[#859287]">Chưa có yêu cầu đổi ca trong phạm vi của bạn.</p> : (
                <div className="divide-y divide-[#edf1eb]">
                  {duLieu.yeuCauGanDay.map((yc) => (
                    <div key={yc.maYeuCau} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <div>
                        <p className="text-sm font-medium text-[#30483a]">{yc.nguoiGui}</p>
                        <p className="mt-1 text-xs text-[#859287]">{yc.maCa} · {ngayVN(yc.ngayLam)}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs ${yc.trangThai === "ChoXetDuyet" ? "bg-amber-50 text-amber-800" : "bg-[#edf3e9] text-[#507355]"}`}>{trangThaiVN(yc.trangThai)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <p className="text-xs text-[#859287]">Dữ liệu lấy từ SQL Server lúc {duLieu.gioHienTai} ngày {ngayVN(duLieu.ngayHienTai)}. Số liệu được cập nhật khi nhấn “Làm mới dữ liệu” hoặc tải lại trang.</p>
        </>
      ) : !loi ? (
        <section className="rounded-xl border border-[#dfe7dc] bg-white p-7 text-sm text-[#859287]">Không tìm thấy dữ liệu tổng quan.</section>
      ) : null}
    </main>
  );
}
