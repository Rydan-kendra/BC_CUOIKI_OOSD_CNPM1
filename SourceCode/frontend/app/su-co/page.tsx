"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { keycloak, khoiTaoKeycloak } from "../../lib/keycloak";
import { layAccessToken } from "../../lib/auth-api";

const API = "http://localhost:3001";

type Ca = {
  maCa: string;
  ngayLam: string;
  gioBatDau: string;
  gioKetThuc: string;
  viTri: string;
  coTheGhiNhan: number;
};

type SuCo = {
  maSuCo: string;
  maCa: string;
  maNhanSuBaoCao: string;
  tenNguoiBaoCao: string;
  ngayLam: string;
  gioBatDau: string;
  gioKetThuc: string;
  noiDung: string;
  mucDo: "ThongThuong" | "QuanTrong";
  trangThai: "ChuaHoanThanh" | "DangXuLy" | "DaXuLy";
  canBanGiaoCaSau: boolean | number;
  viTriPhatSinh: string | null;
  thoiGianPhatSinh: string | null;
  bienPhapBanDau: string | null;
  thoiGianGhiNhan: string | null;
  coTheCapNhat: number;
};

type CapNhat = {
  maCapNhat: string;
  noiDungXuLy: string;
  trangThaiSau: string;
  thoiGianCapNhat: string;
  nguoiCapNhat: string;
};

type DuLieu = {
  taiKhoan: { nhomQuyen: string };
  caCuaToi: Ca[];
  danhSach: SuCo[];
};

type ChiTiet = { suCo: SuCo; lichSu: CapNhat[] };
type TrangThai = SuCo["trangThai"];

function tenTrangThai(value: string) {
  if (value === "ChuaHoanThanh") return "Chưa hoàn thành";
  if (value === "DangXuLy") return "Đang xử lý";
  if (value === "DaXuLy") return "Đã xử lý";
  return value;
}

function docLoi(value: unknown, status: number) {
  if (value && typeof value === "object" && "message" in value) {
    const msg = (value as { message: string | string[] }).message;
    if (typeof msg === "string") return msg;
    if (Array.isArray(msg)) return msg.join("; ");
  }
  return `Không thể kết nối đến hệ thống (HTTP ${status}).`;
}

function ngayVN(value: string) {
  if (!value) return "—";
  const [nam, thang, ngay] = value.slice(0, 10).split("-");
  return `${ngay}/${thang}/${nam}`;
}

function lucNay() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export default function QuanLySuCoPage() {
  const [dangTai, setDangTai] = useState(true);
  const [dangNhap, setDangNhap] = useState(false);
  const [duLieu, setDuLieu] = useState<DuLieu>({
    taiKhoan: { nhomQuyen: "" }, caCuaToi: [], danhSach: [],
  });
  const [maChon, setMaChon] = useState("");
  const [chiTiet, setChiTiet] = useState<ChiTiet | null>(null);
  const [dangTaiChiTiet, setDangTaiChiTiet] = useState(false);
  const [loc, setLoc] = useState("TatCa");
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState("");
  const [thongBao, setThongBao] = useState("");
  const [maCa, setMaCa] = useState("");
  const [viTriPhatSinh, setViTriPhatSinh] = useState("Khu vực phục vụ");
  const [thoiGianPhatSinh, setThoiGianPhatSinh] = useState("");
  const [mucDo, setMucDo] = useState<"ThongThuong" | "QuanTrong">("ThongThuong");
  const [noiDung, setNoiDung] = useState("");
  const [bienPhapBanDau, setBienPhapBanDau] = useState("");
  const [banGiao, setBanGiao] = useState(false);
  const [noiDungXuLy, setNoiDungXuLy] = useState("");
  const [trangThaiSau, setTrangThaiSau] = useState<TrangThai>("DangXuLy");
  const [banGiaoCapNhat, setBanGiaoCapNhat] = useState(false);

  async function napDanhSach(): Promise<DuLieu> {
    const token = await layAccessToken();
    const res = await fetch(`${API}/su-co/du-lieu`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    });
    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(docLoi(data, res.status));
    return data as DuLieu;
  }

  useEffect(() => {
    let hoatDong = true;
    setThoiGianPhatSinh(lucNay());
    async function khoiTao() {
      try {
        const authenticated = await khoiTaoKeycloak();
        if (!hoatDong) return;
        setDangNhap(authenticated);
        if (!authenticated) return;
        const data = await napDanhSach();
        if (!hoatDong) return;
        setDuLieu(data);
        setMaCa(data.caCuaToi.find((c) => Number(c.coTheGhiNhan) === 1)?.maCa ?? "");
        setMaChon(data.danhSach[0]?.maSuCo ?? "");
      } catch (error) {
        if (hoatDong) setLoi(error instanceof Error ? error.message : "Không tải được dữ liệu sự cố");
      } finally {
        if (hoatDong) setDangTai(false);
      }
    }
    void khoiTao();
    return () => { hoatDong = false; };
  }, []);

  useEffect(() => {
    let hoatDong = true;
    if (!maChon) { setChiTiet(null); return; }
    async function napChiTiet() {
      setDangTaiChiTiet(true);
      try {
        const token = await layAccessToken();
        const response = await fetch(`${API}/su-co/chi-tiet/${encodeURIComponent(maChon)}`, {
          headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
        });
        const body: unknown = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(docLoi(body, response.status));
        if (hoatDong) {
          const data = body as ChiTiet;
          setChiTiet(data);
          setTrangThaiSau(data.suCo.trangThai === "DaXuLy" ? "DaXuLy" : "DangXuLy");
          setBanGiaoCapNhat(Boolean(data.suCo.canBanGiaoCaSau));
          setNoiDungXuLy("");
        }
      } catch (error) {
        if (hoatDong) {
          setChiTiet(null);
          setLoi(error instanceof Error ? error.message : "Không tải được chi tiết sự cố");
        }
      } finally {
        if (hoatDong) setDangTaiChiTiet(false);
      }
    }
    void napChiTiet();
    return () => { hoatDong = false; };
  }, [maChon]);

  const caDangLam = useMemo(
    () => duLieu.caCuaToi.filter((c) => Number(c.coTheGhiNhan) === 1),
    [duLieu.caCuaToi],
  );
  const danhSach = useMemo(
    () => duLieu.danhSach.filter((sc) => loc === "TatCa" || sc.trangThai === loc),
    [duLieu.danhSach, loc],
  );

  async function guiSuCo() {
    if (!maCa || !noiDung.trim() || !thoiGianPhatSinh || dangLuu) return;
    setDangLuu(true);
    setLoi("");
    setThongBao("");
    try {
      const token = await layAccessToken();
      const response = await fetch(`${API}/su-co/ghi-nhan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ maCa, viTriPhatSinh, thoiGianPhatSinh, mucDo, noiDung: noiDung.trim(),
          bienPhapBanDau: bienPhapBanDau.trim(), canBanGiaoCaSau: banGiao }),
      });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(docLoi(body, response.status));
      const result = body as { maSuCo: string };
      setThongBao("Đã ghi nhận sự cố. Trưởng ca và Quản lý có thể theo dõi tình trạng xử lý.");
      setNoiDung("");
      setBienPhapBanDau("");
      setBanGiao(false);
      setThoiGianPhatSinh(lucNay());
      try {
        const data = await napDanhSach();
        setDuLieu(data);
        setMaChon(result.maSuCo);
      } catch {
        setThongBao("Đã lưu sự cố nhưng chưa tải lại danh sách. Hãy làm mới trang.");
      }
    } catch (error) {
      setLoi(error instanceof Error ? error.message : "Không thể ghi nhận sự cố");
    } finally {
      setDangLuu(false);
    }
  }

  async function luuCapNhat() {
    if (!chiTiet || !noiDungXuLy.trim() || dangLuu) return;
    if (trangThaiSau === "DaXuLy" && banGiaoCapNhat) {
      setLoi("Sự cố đã xử lý không cần đánh dấu bàn giao cho ca sau.");
      return;
    }
    setDangLuu(true);
    setLoi("");
    setThongBao("");
    try {
      const token = await layAccessToken();
      const response = await fetch(`${API}/su-co/cap-nhat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ maSuCo: chiTiet.suCo.maSuCo, noiDungXuLy: noiDungXuLy.trim(),
          trangThaiSau, canBanGiaoCaSau: banGiaoCapNhat }),
      });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(docLoi(body, response.status));
      setThongBao("Đã cập nhật trạng thái và lưu lịch sử xử lý sự cố.");
      try {
        const data = await napDanhSach();
        setDuLieu(data);
        const detailResponse = await fetch(`${API}/su-co/chi-tiet/${encodeURIComponent(chiTiet.suCo.maSuCo)}`, {
          headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
        });
        if (!detailResponse.ok) throw new Error("Không tải được chi tiết mới");
        const detail = await detailResponse.json() as ChiTiet;
        setChiTiet(detail);
        setNoiDungXuLy("");
      } catch {
        setThongBao("Đã lưu cập nhật nhưng chưa tải lại được dữ liệu. Hãy làm mới trang.");
      }
    } catch (error) {
      setLoi(error instanceof Error ? error.message : "Không thể cập nhật sự cố");
    } finally {
      setDangLuu(false);
    }
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#849386]">ĐIỀU PHỐI VẬN HÀNH</p>
          <h1 className="text-3xl font-semibold text-[#30483a]">
            {duLieu.taiKhoan.nhomQuyen === "QuanLy"
              ? "Quản lý sự cố"
              : duLieu.taiKhoan.nhomQuyen === "NhanVien"
                ? "Ghi nhận sự cố"
                : "Sự cố vận hành"}
          </h1>
          <p className="mt-2 text-sm text-[#748477]">
            {duLieu.taiKhoan.nhomQuyen === "QuanLy"
              ? "Theo dõi, cập nhật tình trạng xử lý sự cố và các vấn đề cần bàn giao trong toàn cửa hàng."
              : "Ghi nhận sự cố trong ca được phân công và theo dõi tình trạng xử lý theo quyền phụ trách."}
          </p>
        </div>
        <Link href="/lich-lam-viec" className="rounded-lg border border-[#d6e0d5] bg-white px-4 py-2.5 text-sm text-[#30483a] hover:bg-[#f8faf7]">Xem lịch làm việc</Link>
      </div>

      {loi && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loi}</p>}
      {thongBao && <p role="status" className="rounded-lg border border-[#d5e4d2] bg-[#f2f7ef] p-4 text-sm text-[#365d3c]">{thongBao}</p>}

      {dangTai ? (
        <section className="rounded-xl border border-[#e2e9e0] bg-white p-6 text-sm text-[#748477]">Đang tải dữ liệu sự cố...</section>
      ) : !dangNhap ? (
        <section className="rounded-xl border border-[#e2e9e0] bg-white p-6">
          <p className="mb-4 text-sm text-[#748477]">Bạn cần đăng nhập để sử dụng chức năng sự cố.</p>
          <button type="button" onClick={() => void khoiTaoKeycloak().then(() => keycloak.login({ redirectUri: window.location.href }))}
            className="rounded-lg bg-[#30483a] px-5 py-3 text-sm font-semibold text-white">Đăng nhập</button>
        </section>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <section className="self-start rounded-xl border border-[#e2e9e0] bg-white p-5 md:p-6">
              <h2 className="text-lg font-semibold text-[#30483a]">Ghi nhận sự cố mới</h2>
              <p className="mt-1 text-sm text-[#748477]">Chỉ ghi nhận trong ca đang làm việc và bạn được phân công.</p>
              {caDangLam.length === 0 ? (
                <p className="mt-5 rounded-lg bg-[#f4f7f2] p-4 text-sm text-[#6f8070]">Hiện không có ca nào bạn được phân công đang diễn ra. Bạn vẫn có thể xem các sự cố trong phạm vi được phép.</p>
              ) : (
                <div className="mt-5 space-y-4">
                  <div>
                    <label htmlFor="sc-ca" className="mb-2 block text-sm font-medium text-[#445949]">Ca làm việc</label>
                    <select id="sc-ca" value={maCa} onChange={(e) => setMaCa(e.target.value)} className="w-full rounded-lg border border-[#dce5da] px-3 py-2.5 text-sm">
                      {caDangLam.map((ca) => <option key={ca.maCa} value={ca.maCa}>{ca.maCa} · {ngayVN(ca.ngayLam)} · {ca.gioBatDau.slice(0, 5)}–{ca.gioKetThuc.slice(0, 5)} · {ca.viTri}</option>)}
                    </select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="sc-vi-tri" className="mb-2 block text-sm font-medium text-[#445949]">Vị trí phát sinh</label>
                      <select id="sc-vi-tri" value={viTriPhatSinh} onChange={(e) => setViTriPhatSinh(e.target.value)} className="w-full rounded-lg border border-[#dce5da] px-3 py-2.5 text-sm">
                        {["Trưởng ca", "Pha chế", "Thu ngân", "Khu vực phục vụ"].map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="sc-muc-do" className="mb-2 block text-sm font-medium text-[#445949]">Mức độ</label>
                      <select id="sc-muc-do" value={mucDo} onChange={(e) => setMucDo(e.target.value as "ThongThuong" | "QuanTrong")} className="w-full rounded-lg border border-[#dce5da] px-3 py-2.5 text-sm">
                        <option value="ThongThuong">Thông thường</option>
                        <option value="QuanTrong">Quan trọng</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="sc-thoi-gian" className="mb-2 block text-sm font-medium text-[#445949]">Thời gian phát sinh</label>
                    <input id="sc-thoi-gian" type="datetime-local" value={thoiGianPhatSinh} onChange={(e) => setThoiGianPhatSinh(e.target.value)} className="w-full rounded-lg border border-[#dce5da] px-3 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="sc-noi-dung" className="mb-2 block text-sm font-medium text-[#445949]">Mô tả sự cố</label>
                    <textarea id="sc-noi-dung" rows={3} maxLength={5000} value={noiDung} onChange={(e) => setNoiDung(e.target.value)} placeholder="Mô tả vấn đề xảy ra và ảnh hưởng đến vận hành..." className="w-full rounded-lg border border-[#dce5da] px-3 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="sc-bien-phap" className="mb-2 block text-sm font-medium text-[#445949]">Biện pháp ban đầu (nếu có)</label>
                    <textarea id="sc-bien-phap" rows={2} maxLength={1000} value={bienPhapBanDau} onChange={(e) => setBienPhapBanDau(e.target.value)} placeholder="Các bước đã thực hiện..." className="w-full rounded-lg border border-[#dce5da] px-3 py-2.5 text-sm" />
                  </div>
                  <label className="flex items-start gap-2 text-sm text-[#526655]">
                    <input type="checkbox" checked={banGiao} onChange={(e) => setBanGiao(e.target.checked)} className="mt-1" />
                    Cần tiếp tục theo dõi và bàn giao cho ca sau
                  </label>
                  <button type="button" onClick={() => void guiSuCo()} disabled={dangLuu || !noiDung.trim() || !maCa || !thoiGianPhatSinh}
                    className="rounded-lg bg-[#30483a] px-5 py-3 text-sm font-semibold text-white hover:bg-[#45664d] disabled:cursor-not-allowed disabled:opacity-45">
                    {dangLuu ? "Đang lưu..." : "Lưu sự cố"}
                  </button>
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-xl border border-[#e2e9e0] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9eee7] px-5 py-4 md:px-6">
                <div>
                  <h2 className="text-lg font-semibold text-[#30483a]">Danh sách sự cố</h2>
                  <p className="mt-1 text-xs text-[#859287]">Theo phạm vi ca và quyền tài khoản</p>
                </div>
                <select aria-label="Lọc trạng thái sự cố" value={loc} onChange={(e) => setLoc(e.target.value)} className="rounded-lg border border-[#dce5da] bg-white px-3 py-2 text-sm text-[#30483a]">
                  <option value="TatCa">Tất cả</option>
                  <option value="ChuaHoanThanh">Chưa hoàn thành</option>
                  <option value="DangXuLy">Đang xử lý</option>
                  <option value="DaXuLy">Đã xử lý</option>
                </select>
              </div>
              <div className="max-h-[630px] divide-y divide-[#edf1eb] overflow-y-auto">
                {danhSach.length === 0 ? (
                  <p className="p-6 text-sm text-[#859287]">Không có sự cố phù hợp.</p>
                ) : danhSach.map((suCo) => (
                  <button type="button" key={suCo.maSuCo} onClick={() => { setMaChon(suCo.maSuCo); setLoi(""); }}
                    className={`w-full px-5 py-4 text-left transition-colors hover:bg-[#f6f9f4] ${maChon === suCo.maSuCo ? "bg-[#edf3e9]" : "bg-white"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#536955]">{suCo.maCa} · {ngayVN(suCo.ngayLam)}</span>
                      <span className={`rounded-full px-2 py-1 text-xs ${suCo.mucDo === "QuanTrong" ? "bg-amber-100 text-amber-800" : "bg-[#eff3ed] text-[#607563]"}`}>
                        {suCo.mucDo === "QuanTrong" ? "Quan trọng" : "Thông thường"}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-[#30483a]">{suCo.noiDung}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#7d8d80]">
                      <span>{tenTrangThai(suCo.trangThai)}</span>
                      {Boolean(suCo.canBanGiaoCaSau) && <span className="text-amber-700">Cần bàn giao ca sau</span>}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-[#e2e9e0] bg-white p-5 md:p-6">
            <h2 className="text-lg font-semibold text-[#30483a]">Chi tiết và lịch sử xử lý</h2>
            {dangTaiChiTiet ? (
              <p className="mt-4 text-sm text-[#859287]">Đang tải chi tiết sự cố...</p>
            ) : !chiTiet ? (
              <p className="mt-4 text-sm text-[#859287]">Chọn một sự cố trong danh sách để xem chi tiết và các lần cập nhật.</p>
            ) : (
              <div className="mt-5 grid gap-8 xl:grid-cols-2">
                <div className="space-y-4 text-sm">
                  <div className="rounded-lg bg-[#f4f7f2] p-4 text-[#526655]">
                    <p><span className="font-semibold text-[#30483a]">Mã sự cố:</span> {chiTiet.suCo.maSuCo}</p>
                    <p className="mt-2"><span className="font-semibold text-[#30483a]">Ca:</span> {chiTiet.suCo.maCa} · {ngayVN(chiTiet.suCo.ngayLam)}</p>
                    <p className="mt-2"><span className="font-semibold text-[#30483a]">Người báo cáo:</span> {chiTiet.suCo.tenNguoiBaoCao}</p>
                    <p className="mt-2"><span className="font-semibold text-[#30483a]">Vị trí:</span> {chiTiet.suCo.viTriPhatSinh ?? "Chưa có thông tin"}</p>
                    <p className="mt-2"><span className="font-semibold text-[#30483a]">Phát sinh lúc:</span> {chiTiet.suCo.thoiGianPhatSinh?.replace(" ", " · ") ?? "Chưa có thông tin"}</p>
                    <p className="mt-2"><span className="font-semibold text-[#30483a]">Mức độ:</span> {chiTiet.suCo.mucDo === "QuanTrong" ? "Quan trọng" : "Thông thường"}</p>
                    <p className="mt-2"><span className="font-semibold text-[#30483a]">Trạng thái:</span> {tenTrangThai(chiTiet.suCo.trangThai)}</p>
                    <p className="mt-2"><span className="font-semibold text-[#30483a]">Cần bàn giao:</span> {Boolean(chiTiet.suCo.canBanGiaoCaSau) ? "Có" : "Không"}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#30483a]">Nội dung sự cố</h3>
                    <p className="mt-2 whitespace-pre-wrap leading-6 text-[#526655]">{chiTiet.suCo.noiDung}</p>
                  </div>
                  {chiTiet.suCo.bienPhapBanDau && <div>
                    <h3 className="font-semibold text-[#30483a]">Biện pháp ban đầu</h3>
                    <p className="mt-2 whitespace-pre-wrap leading-6 text-[#526655]">{chiTiet.suCo.bienPhapBanDau}</p>
                  </div>}
                  {Number(chiTiet.suCo.coTheCapNhat) === 1 && chiTiet.suCo.trangThai !== "DaXuLy" && (
                    <div className="space-y-4 rounded-lg border border-[#dce5da] p-4">
                      <h3 className="font-semibold text-[#30483a]">Cập nhật xử lý</h3>
                      <div>
                        <label htmlFor="sc-noi-dung-xu-ly" className="mb-2 block font-medium text-[#445949]">Nội dung hoặc biện pháp đã thực hiện</label>
                        <textarea id="sc-noi-dung-xu-ly" rows={3} maxLength={5000} value={noiDungXuLy} onChange={(e) => setNoiDungXuLy(e.target.value)} className="w-full rounded-lg border border-[#dce5da] px-3 py-2.5" />
                      </div>
                      <div>
                        <label htmlFor="sc-trang-thai" className="mb-2 block font-medium text-[#445949]">Trạng thái sau cập nhật</label>
                        <select id="sc-trang-thai" value={trangThaiSau} onChange={(e) => { const v = e.target.value as TrangThai; setTrangThaiSau(v); if (v === "DaXuLy") setBanGiaoCapNhat(false); }} className="w-full rounded-lg border border-[#dce5da] px-3 py-2.5">
                          <option value="ChuaHoanThanh">Chưa hoàn thành</option>
                          <option value="DangXuLy">Đang xử lý</option>
                          <option value="DaXuLy">Đã xử lý</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-[#526655]">
                        <input type="checkbox" checked={banGiaoCapNhat} disabled={trangThaiSau === "DaXuLy"} onChange={(e) => setBanGiaoCapNhat(e.target.checked)} />
                        Cần bàn giao cho ca sau
                      </label>
                      <button type="button" onClick={() => void luuCapNhat()} disabled={dangLuu || noiDungXuLy.trim().length < 5}
                        className="rounded-lg bg-[#30483a] px-5 py-3 font-semibold text-white hover:bg-[#45664d] disabled:opacity-45">
                        {dangLuu ? "Đang lưu..." : "Lưu cập nhật"}
                      </button>
                    </div>
                  )}
                  {chiTiet.suCo.trangThai === "DaXuLy" && <p className="rounded-lg bg-[#edf7e9] p-4 text-[#3b6341]">Sự cố đã xử lý, lịch sử được giữ nguyên và không chỉnh sửa lại.</p>}
                  {Number(chiTiet.suCo.coTheCapNhat) !== 1 && <p className="text-[#859287]">Bạn có quyền xem, nhưng chỉ Trưởng ca phụ trách và Quản lý mới được cập nhật xử lý.</p>}
                </div>
                <div>
                  <h3 className="font-semibold text-[#30483a]">Nhật ký xử lý ({chiTiet.lichSu.length})</h3>
                  <div className="mt-4 space-y-3">
                    {chiTiet.lichSu.length === 0 ? <p className="text-sm text-[#859287]">Chưa có lịch sử xử lý.</p> : chiTiet.lichSu.map((lan) => (
                      <div key={lan.maCapNhat} className="rounded-lg border border-[#e1e9de] px-4 py-3">
                        <div className="flex flex-wrap justify-between gap-2 text-xs text-[#788b79]">
                          <span className="font-semibold text-[#405845]">{lan.nguoiCapNhat}</span>
                          <span>{lan.thoiGianCapNhat?.replace(" ", " · ")}</span>
                        </div>
                        <p className="mt-2 text-xs text-[#6d806f]">{tenTrangThai(lan.trangThaiSau)}</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#405845]">{lan.noiDungXuLy}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
