"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { keycloak, khoiTaoKeycloak } from "../../lib/keycloak";
import { layAccessToken } from "../../lib/auth-api";

const API = "http://localhost:3001";
const VI_TRI = ["Trưởng ca", "Pha chế", "Thu ngân", "Khu vực phục vụ"] as const;
type ViTri = (typeof VI_TRI)[number];
type LuaChon = Record<ViTri, string>;
type CheDo = "tuan" | "ngay";

type NhanSu = {
  maNhanSu: string;
  hoTen: string;
  loaiNhanSu: string;
  soDienThoai: string | null;
};

type PhanCong = {
  maPhanCong: string;
  maNhanSu: string;
  hoTen: string;
  loaiNhanSu: string;
  viTri: string;
};

type CaLamViec = {
  maCa: string;
  ngayLam: string;
  gioBatDau: string;
  gioKetThuc: string;
  trangThai: string;
  soNguoiDaPhanCong: number;
  phanCong: PhanCong[];
};

function luaChonRong(): LuaChon {
  return {
    "Trưởng ca": "",
    "Pha chế": "",
    "Thu ngân": "",
    "Khu vực phục vụ": "",
  };
}

function luaChonCuaCa(ca: CaLamViec): LuaChon {
  const ketQua = luaChonRong();
  for (const viTri of VI_TRI) {
    ketQua[viTri] = ca.phanCong.find((pc) => pc.viTri === viTri)?.maNhanSu ?? "";
  }
  return ketQua;
}

function dinhDangNgay(iso: string) {
  const [nam, thang, ngay] = iso.slice(0, 10).split("-");
  return `${ngay}/${thang}/${nam}`;
}

function congNgay(iso: string, soNgay: number) {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + soNgay);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function dauTuan(iso: string) {
  const ngay = new Date(`${iso.slice(0, 10)}T12:00:00`).getDay();
  return congNgay(iso, -(ngay === 0 ? 6 : ngay - 1));
}

function tenCa(ca: CaLamViec) {
  const batDau = ca.gioBatDau.slice(0, 5);
  if (batDau >= "06:00" && batDau < "14:00") return "Ca sáng";
  if (batDau >= "14:00" && batDau < "22:00") return "Ca chiều";
  return "Ca làm việc";
}

function tenTrangThai(trangThai: string) {
  const bang: Record<string, string> = {
    ChuaPhanCong: "Chưa phân công",
    DaPhanCong: "Đã phân công",
    DangDienRa: "Đang diễn ra",
    ChoBanGiao: "Chờ bàn giao",
    DaKetThuc: "Đã kết thúc",
  };
  return bang[trangThai] ?? trangThai;
}

function tenLoai(loai: string) {
  const bang: Record<string, string> = {
    BanThoiGian: "Bán thời gian",
    ToanThoiGian: "Toàn thời gian",
    QuanLy: "Quản lý",
  };
  return bang[loai] ?? loai;
}

async function layDuLieu(): Promise<{ cacCa: CaLamViec[]; cacNhanSu: NhanSu[] }> {
  const token = await layAccessToken();
  const headers = { Authorization: `Bearer ${token}` };
  const [ca, nhanSu] = await Promise.all([
    fetch(`${API}/ca-lam-viec/lich`, { headers, cache: "no-store" }),
    fetch(`${API}/nhan-su`, { headers, cache: "no-store" }),
  ]);
  if (!ca.ok || !nhanSu.ok) {
    throw new Error(`Không tải được dữ liệu (ca: ${ca.status}, nhân sự: ${nhanSu.status}).`);
  }
  return {
    cacCa: (await ca.json()) as CaLamViec[],
    cacNhanSu: (await nhanSu.json()) as NhanSu[],
  };
}

export default function PhanCongCaPage() {
  const [cacCa, setCacCa] = useState<CaLamViec[]>([]);
  const [cacNhanSu, setCacNhanSu] = useState<NhanSu[]>([]);
  const [ngayChon, setNgayChon] = useState("");
  const [cheDo, setCheDo] = useState<CheDo>("tuan");
  const [maCaChon, setMaCaChon] = useState("");
  const [luaChon, setLuaChon] = useState<LuaChon>(luaChonRong);
  const [daKiemTra, setDaKiemTra] = useState(false);
  const [daDangNhap, setDaDangNhap] = useState(false);
  const [laQuanLy, setLaQuanLy] = useState(false);
  const [dangTai, setDangTai] = useState(false);
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState("");
  const [thongBao, setThongBao] = useState("");

  const napLai = useCallback(async (chonCaDauTien: boolean) => {
    const duLieu = await layDuLieu();
    setCacCa(duLieu.cacCa);
    setCacNhanSu(duLieu.cacNhanSu);
    if (chonCaDauTien) {
      const caDauTien = duLieu.cacCa[0];
      if (caDauTien) {
        setNgayChon(caDauTien.ngayLam.slice(0, 10));
        setMaCaChon(caDauTien.maCa);
        setLuaChon(luaChonCuaCa(caDauTien));
      }
    }
    return duLieu;
  }, []);

  useEffect(() => {
    let hoatDong = true;
    async function khoiTao() {
      try {
        const authenticated = await khoiTaoKeycloak();
        if (!hoatDong) return;
        setDaDangNhap(authenticated);
        setLaQuanLy(authenticated && keycloak.hasRealmRole("QuanLy"));
        setDaKiemTra(true);
        if (!authenticated) return;
        setDangTai(true);
        const duLieu = await layDuLieu();
        if (!hoatDong) return;
        setCacCa(duLieu.cacCa);
        setCacNhanSu(duLieu.cacNhanSu);
        const caDauTien = duLieu.cacCa[0];
        if (caDauTien) {
          setNgayChon(caDauTien.ngayLam.slice(0, 10));
          setMaCaChon(caDauTien.maCa);
          setLuaChon(luaChonCuaCa(caDauTien));
        }
      } catch (error) {
        if (hoatDong) setLoi(error instanceof Error ? error.message : "Không tải được dữ liệu.");
      } finally {
        if (hoatDong) {
          setDaKiemTra(true);
          setDangTai(false);
        }
      }
    }
    void khoiTao();
    return () => { hoatDong = false; };
  }, []);

  const caChon = cacCa.find((ca) => ca.maCa === maCaChon);
  const duocSua = laQuanLy &&
    (caChon?.trangThai === "ChuaPhanCong" || caChon?.trangThai === "DaPhanCong");
  const ngayBatDau = ngayChon ? (cheDo === "tuan" ? dauTuan(ngayChon) : ngayChon) : "";
  const ngayKetThuc = ngayBatDau ? congNgay(ngayBatDau, cheDo === "tuan" ? 6 : 0) : "";

  const cacCaTrongKhoang = useMemo(() =>
    cacCa.filter((ca) => {
      const ngay = ca.ngayLam.slice(0, 10);
      return ngayBatDau && ngay >= ngayBatDau && ngay <= ngayKetThuc;
    }), [cacCa, ngayBatDau, ngayKetThuc],
  );

  const maDaChon = VI_TRI.map((vt) => luaChon[vt]).filter(Boolean);
  const coDuNguoi = maDaChon.length === 4 && new Set(maDaChon).size === 4;
  const coToanThoiGian = maDaChon.some((ma) =>
    cacNhanSu.some((ns) => ns.maNhanSu === ma && ns.loaiNhanSu === "ToanThoiGian"),
  );
  const maQuanLy = maDaChon.find((ma) =>
    cacNhanSu.find((ns) => ns.maNhanSu === ma)?.loaiNhanSu === "QuanLy",
  );
  const truongCa = cacNhanSu.find((ns) => ns.maNhanSu === luaChon["Trưởng ca"]);
  const truongCaHopLe = !maQuanLy
    ? truongCa?.loaiNhanSu === "ToanThoiGian"
    : maQuanLy === luaChon["Trưởng ca"];
  const phanCongHopLe = coDuNguoi && coToanThoiGian && truongCaHopLe;

  function chonCa(ca: CaLamViec) {
    setMaCaChon(ca.maCa);
    setLuaChon(luaChonCuaCa(ca));
    setLoi("");
    setThongBao("");
  }

  function doiNgay(huong: number) {
    if (!ngayChon) return;
    const ngayMoi = congNgay(ngayChon, huong * (cheDo === "tuan" ? 7 : 1));
    setNgayChon(ngayMoi);
    const ngayDau = cheDo === "tuan" ? dauTuan(ngayMoi) : ngayMoi;
    const ngayCuoi = congNgay(ngayDau, cheDo === "tuan" ? 6 : 0);
    const caMoi = cacCa.find((ca) => ca.ngayLam.slice(0, 10) >= ngayDau && ca.ngayLam.slice(0, 10) <= ngayCuoi);
    if (caMoi) chonCa(caMoi);
    else { setMaCaChon(""); setLuaChon(luaChonRong()); }
  }

  async function dangNhap() {
    await khoiTaoKeycloak();
    await keycloak.login({ redirectUri: "http://localhost:3000/phan-cong-ca" });
  }

  async function luuPhanCong() {
    if (!caChon || !duocSua) return;
    setLoi("");
    setThongBao("");

    if (!phanCongHopLe) {
      setLoi("Cần 4 người khác nhau, ít nhất một nhân viên toàn thời gian và Trưởng ca hợp lệ.");
      return;
    }

    const danhSachCu = luaChonCuaCa(caChon);
    const coThayDoi = VI_TRI.some((viTri) => danhSachCu[viTri] !== luaChon[viTri]);
    if (!coThayDoi) {
      setThongBao("Danh sách phân công hiện tại không có thay đổi.");
      return;
    }

    setDangLuu(true);
    const maCaDangLuu = caChon.maCa;

    try {
      const token = await layAccessToken();
      let response: Response;

      try {
        response = await fetch(`${API}/phan-cong-ca/luu`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            maCa: maCaDangLuu,
            phanCong: VI_TRI.map((viTri) => ({
              viTri,
              maNhanSu: luaChon[viTri],
            })),
          }),
        });
      } catch {
        throw new Error(
          "Không kết nối được đến API lưu phân công (PUT /phan-cong-ca/luu). " +
          "Kiểm tra Backend http://localhost:3001 và lỗi CORS/OPTIONS trong F12 > Network. " +
          "Có thể yêu cầu đã tới server nhưng trình duyệt không nhận được phản hồi; hãy kiểm tra lịch trước khi thử lưu lại.",
        );
      }

      const ketQua = await response.json().catch(() => ({}));
      if (!response.ok) {
        const thongDiep = Array.isArray(ketQua.message)
          ? ketQua.message.join("; ")
          : ketQua.message;
        throw new Error(
          thongDiep || `Lưu phân công thất bại (HTTP ${response.status}).`,
        );
      }

      setThongBao(ketQua.thongBao ?? "Đã lưu phân công thành công vào hệ thống.");

      try {
        const duLieuMoi = await napLai(false);
        const caMoi = duLieuMoi.cacCa.find((ca) => ca.maCa === maCaDangLuu);
        if (caMoi) setLuaChon(luaChonCuaCa(caMoi));
        setThongBao(
          `${ketQua.thongBao ?? "Đã lưu phân công"}. Dữ liệu trên trang đã được cập nhật.`,
        );
      } catch {
        setThongBao(
          "API đã xác nhận lưu phân công thành công, nhưng trang chưa tải lại được dữ liệu. " +
          "Hãy mở lại trang Lịch làm việc để kiểm tra; không cần bấm Lưu lần nữa ngay.",
        );
      }
    } catch (error) {
      setLoi(error instanceof Error ? error.message : "Không thể lưu phân công ca.");
    } finally {
      setDangLuu(false);
    }
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#849386]">Điều phối vận hành</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#30483a]">Phân công ca</h1>
          <p className="mt-2 text-sm text-[#748477]">Theo dõi và điều chỉnh nhân sự trong từng ca làm việc.</p>
        </div>
        <Link href="/lich-lam-viec" className="rounded-lg border border-[#d4dfd4] bg-white px-4 py-2.5 text-sm font-medium text-[#30483a] hover:bg-[#f4f7f3]">
          Xem lịch làm việc
        </Link>
      </div>

      {!daKiemTra ? (
        <div className="rounded-xl bg-white p-8 text-center text-sm text-[#748477]">Đang kiểm tra đăng nhập...</div>
      ) : !daDangNhap ? (
        <section className="rounded-xl border border-[#e1e8df] bg-white p-8 text-center">
          <p className="mb-4 text-sm text-[#748477]">Bạn cần đăng nhập để xem phân công ca.</p>
          <button type="button" onClick={dangNhap} className="rounded-lg bg-[#30483a] px-5 py-2.5 text-sm font-medium text-white">Đăng nhập</button>
        </section>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { ten: "Ca trong khoảng xem", so: cacCaTrongKhoang.length },
              { ten: "Chưa phân công", so: cacCaTrongKhoang.filter((ca) => ca.trangThai === "ChuaPhanCong").length },
              { ten: "Đã phân công", so: cacCaTrongKhoang.filter((ca) => ca.trangThai === "DaPhanCong").length },
            ].map((item) => (
              <div key={item.ten} className="rounded-xl border border-[#e2e9e0] bg-white px-5 py-4">
                <p className="text-xs text-[#839185]">{item.ten}</p>
                <p className="mt-2 text-3xl font-semibold text-[#30483a]">{dangTai ? "—" : item.so}</p>
              </div>
            ))}
          </div>

          {loi && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loi}</p>}
          {thongBao && <p role="status" className="rounded-lg border border-[#d5e4d2] bg-[#f2f7ef] p-4 text-sm text-[#365d3c]">{thongBao}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e2e9e0] bg-white p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[#8a9a8b]">Khoảng lịch</p>
              <p className="mt-1 text-sm font-semibold text-[#30483a]">
                {ngayBatDau ? `${dinhDangNgay(ngayBatDau)} – ${dinhDangNgay(ngayKetThuc)}` : "Chưa có lịch"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => doiNgay(-1)} aria-label="Khoảng trước" className="rounded-lg border border-[#dbe4da] px-3 py-2 text-[#30483a]">‹</button>
              <button type="button" onClick={() => doiNgay(1)} aria-label="Khoảng sau" className="rounded-lg border border-[#dbe4da] px-3 py-2 text-[#30483a]">›</button>
              <input type="date" aria-label="Chọn ngày" value={ngayChon} onChange={(event) => {
                const iso = event.target.value;
                setNgayChon(iso);
                const ca = cacCa.find((item) => item.ngayLam.slice(0, 10) === iso);
                if (ca) chonCa(ca);
                else { setMaCaChon(""); setLuaChon(luaChonRong()); }
              }} className="rounded-lg border border-[#dbe4da] bg-white px-3 py-2 text-sm text-[#30483a]" />
              <select value={cheDo} onChange={(event) => setCheDo(event.target.value as CheDo)} aria-label="Kiểu xem lịch" className="rounded-lg border border-[#dbe4da] bg-white px-3 py-2 text-sm text-[#30483a]">
                <option value="tuan">Theo tuần</option>
                <option value="ngay">Theo ngày</option>
              </select>
            </div>
          </div>

          {dangTai ? (
            <div className="rounded-xl bg-white p-8 text-center text-sm text-[#748477]">Đang tải ca và nhân sự...</div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <section className="overflow-hidden rounded-xl border border-[#e2e9e0] bg-white">
                <div className="border-b border-[#edf1eb] p-5">
                  <h2 className="font-semibold text-[#30483a]">Các ca trong lịch</h2>
                  <p className="mt-1 text-xs text-[#839185]">Chọn ca để xem hoặc cập nhật phân công.</p>
                </div>
                <div className="max-h-[720px] space-y-2 overflow-y-auto p-3">
                  {cacCaTrongKhoang.map((ca) => (
                    <button type="button" key={ca.maCa} onClick={() => chonCa(ca)} className={`w-full rounded-lg border p-4 text-left transition-colors ${ca.maCa === maCaChon ? "border-[#7c9a7f] bg-[#eff5ec]" : "border-[#edf1eb] hover:bg-[#f7f9f5]"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-[#899889]">{dinhDangNgay(ca.ngayLam)}</p>
                          <p className="mt-1 font-semibold text-[#30483a]">{tenCa(ca)} <span className="font-normal text-[#7c8b7f]">· {ca.gioBatDau.slice(0, 5)}–{ca.gioKetThuc.slice(0, 5)}</span></p>
                        </div>
                        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-[#58745b]">{ca.soNguoiDaPhanCong}/4</span>
                      </div>
                      <p className="mt-2 text-xs text-[#617967]">{tenTrangThai(ca.trangThai)} · {ca.maCa}</p>
                    </button>
                  ))}
                  {cacCaTrongKhoang.length === 0 && <p className="p-6 text-center text-sm text-[#839185]">Không có ca trong khoảng này.</p>}
                </div>
              </section>

              <section className="rounded-xl border border-[#e2e9e0] bg-white p-5 md:p-6">
                {!caChon ? (
                  <p className="text-sm text-[#839185]">Chọn một ca để xem chi tiết.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#edf1eb] pb-5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#829485]">Chi tiết phân công</p>
                        <h2 className="mt-2 text-xl font-semibold text-[#30483a]">{tenCa(caChon)} · {dinhDangNgay(caChon.ngayLam)}</h2>
                        <p className="mt-1 text-sm text-[#718373]">{caChon.maCa} · {caChon.gioBatDau.slice(0, 5)}–{caChon.gioKetThuc.slice(0, 5)}</p>
                      </div>
                      <span className="rounded-md bg-[#eef3eb] px-3 py-2 text-xs font-medium text-[#47684e]">{tenTrangThai(caChon.trangThai)}</span>
                    </div>

                    <p className="my-5 text-sm leading-6 text-[#66796b]">
                      {duocSua
                        ? "Có thể lưu mới hoặc sửa người ở từng vị trí. Thay đổi được kiểm tra trước khi cập nhật lịch."
                        : laQuanLy
                          ? "Ca đang vận hành hoặc đã có bước bàn giao, không thể sửa phân công trực tiếp."
                          : "Bạn có quyền xem phân công; chỉ Quản lý mới có quyền chỉnh sửa."}
                    </p>

                    <div className="space-y-4">
                      {VI_TRI.map((viTri, index) => {
                        const nguoiHienTai = caChon.phanCong.find((pc) => pc.viTri === viTri);
                        return (
                          <div key={viTri} className="rounded-lg border border-[#e4eae2] p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <label htmlFor={`phan-cong-${index}`} className="text-sm font-semibold text-[#30483a]">{viTri}</label>
                              <span className="text-xs text-[#9aa89a]">{index + 1}/4</span>
                            </div>
                            {duocSua ? (
                              <select id={`phan-cong-${index}`} value={luaChon[viTri]} disabled={dangLuu} onChange={(event) => setLuaChon((cu) => ({ ...cu, [viTri]: event.target.value }))} className="w-full rounded-lg border border-[#dce5da] bg-white px-3 py-3 text-sm text-[#30483a] focus:border-[#64846a] focus:outline-none disabled:opacity-50">
                                <option value="">-- Chọn nhân sự --</option>
                                {cacNhanSu.filter((ns) => viTri === "Trưởng ca" ? ns.loaiNhanSu !== "BanThoiGian" : ns.loaiNhanSu !== "QuanLy").map((ns) => {
                                  const dangOChoKhac = VI_TRI.some((vt) => vt !== viTri && luaChon[vt] === ns.maNhanSu);
                                  const trungCaKhac = cacCa.some((ca) => ca.maCa !== caChon.maCa && ca.ngayLam.slice(0, 10) === caChon.ngayLam.slice(0, 10) && ca.gioBatDau < caChon.gioKetThuc && ca.gioKetThuc > caChon.gioBatDau && ca.phanCong.some((pc) => pc.maNhanSu === ns.maNhanSu));
                                  return (
                                    <option key={ns.maNhanSu} value={ns.maNhanSu} disabled={dangOChoKhac || trungCaKhac}>
                                      {ns.maNhanSu} · {ns.hoTen} ({tenLoai(ns.loaiNhanSu)}){trungCaKhac ? " – Trùng lịch" : ""}
                                    </option>
                                  );
                                })}
                              </select>
                            ) : (
                              <p id={`phan-cong-${index}`} className="text-sm text-[#445c49]">{nguoiHienTai ? `${nguoiHienTai.hoTen} (${nguoiHienTai.maNhanSu}) · ${tenLoai(nguoiHienTai.loaiNhanSu)}` : "Chưa phân công"}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {duocSua && (
                      <>
                        <p className="mt-5 rounded-lg bg-[#f2f6f0] p-4 text-xs leading-6 text-[#617b64]">
                          Đã chọn {maDaChon.length}/4 vị trí. Cần 4 người khác nhau, ít nhất 1 nhân viên toàn thời gian, Trưởng ca đúng quy định và không trùng lịch.
                        </p>
                        <div className="mt-5 flex flex-wrap gap-3">
                          <button type="button" onClick={luuPhanCong} disabled={dangLuu || !phanCongHopLe} className="rounded-lg bg-[#30483a] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#45634e] disabled:cursor-not-allowed disabled:opacity-45">
                            {dangLuu ? "Đang lưu..." : "Lưu phân công"}
                          </button>
                          <button type="button" disabled={dangLuu} onClick={() => { setLuaChon(luaChonCuaCa(caChon)); setLoi(""); }} className="rounded-lg border border-[#d7e2d5] px-5 py-3 text-sm text-[#567058] disabled:opacity-45">Hủy thay đổi</button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </main>
  );
}
