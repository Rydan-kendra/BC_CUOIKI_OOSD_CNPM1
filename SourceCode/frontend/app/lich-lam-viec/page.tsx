"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { keycloak, khoiTaoKeycloak } from "../../lib/keycloak";
import { layAccessToken } from "../../lib/auth-api";

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

type CheDo = "ngay" | "tuan";
const VI_TRI = ["Trưởng ca", "Pha chế", "Thu ngân", "Khu vực phục vụ"] as const;

function ngayISO(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function congNgay(iso: string, soNgay: number) {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + soNgay);
  return ngayISO(date);
}

function dauTuan(iso: string) {
  const thu = new Date(`${iso.slice(0, 10)}T12:00:00`).getDay();
  return congNgay(iso, -(thu === 0 ? 6 : thu - 1));
}

function dinhDangNgay(iso: string) {
  const [nam, thang, ngay] = iso.slice(0, 10).split("-");
  return `${ngay}/${thang}/${nam}`;
}

function tenNgay(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("vi-VN", { weekday: "short" });
}

function tenCa(ca: CaLamViec) {
  const gio = ca.gioBatDau.slice(0, 5);
  if (gio >= "06:00" && gio < "14:00") return "Ca sáng";
  if (gio >= "14:00" && gio < "22:00") return "Ca chiều";
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

function hienThiCa(ca: CaLamViec | undefined, duocChon: boolean, chonCa: (ma: string) => void, nho: boolean, locNhanSu: boolean) {
  if (!ca) {
    return <div className="rounded-lg border border-dashed border-[#e2e9e0] p-3 text-xs text-[#a1afa2]">{locNhanSu ? "Không có phân công" : "Chưa có ca"}</div>;
  }
  const daPhanCong = ca.soNguoiDaPhanCong === 4;
  return (
    <button type="button" key={ca.maCa} onClick={() => chonCa(ca.maCa)}
      className={`w-full rounded-lg border text-left transition-colors ${nho ? "p-3" : "p-5"} ${duocChon ? "border-[#678c6c] bg-[#eef5eb]" : "border-[#e5ebe3] bg-white hover:bg-[#f6f9f4]"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`font-semibold text-[#30483a] ${nho ? "text-xs" : "text-base"}`}>{tenCa(ca)}</p>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: daPhanCong ? "#719576" : "#d3aa69" }} />
      </div>
      <p className={`mt-1 tabular-nums text-[#697a6c] ${nho ? "text-xs" : "text-sm"}`}>{ca.gioBatDau.slice(0, 5)}–{ca.gioKetThuc.slice(0, 5)}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-[#809181]">{ca.soNguoiDaPhanCong}/4 nhân sự</span>
        {!nho && <span className="text-xs font-medium text-[#637a67]">{tenTrangThai(ca.trangThai)}</span>}
      </div>
    </button>
  );
}

export default function LichLamViecPage() {
  const [cacCa, setCacCa] = useState<CaLamViec[]>([]);
  const [ngayChon, setNgayChon] = useState("");
  const [cheDo, setCheDo] = useState<CheDo>("tuan");
  const [maCaChon, setMaCaChon] = useState("");
  const [maNhanSuLoc, setMaNhanSuLoc] = useState("");
  const [daDangNhap, setDaDangNhap] = useState(false);
  const [daKiemTra, setDaKiemTra] = useState(false);
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState("");

  useEffect(() => {
    let hoatDong = true;

    async function taiLich() {
      try {
        const authenticated = await khoiTaoKeycloak();
        if (!hoatDong) return;
        setDaDangNhap(authenticated);
        setDaKiemTra(true);
        if (!authenticated) return;

        setDangTai(true);
        const token = await layAccessToken();
        const response = await fetch("http://localhost:3001/ca-lam-viec/lich", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Không tải được lịch làm việc (HTTP ${response.status}).`);
        const ketQua = (await response.json()) as CaLamViec[];
        if (!hoatDong) return;

        setCacCa(ketQua);
        setNgayChon((cu) => {
          if (cu) return cu;
          const homNay = ngayISO(new Date());
          const coHomNay = ketQua.some((ca) => ca.ngayLam.slice(0, 10) === homNay);
          return coHomNay ? homNay : (ketQua[0]?.ngayLam.slice(0, 10) ?? homNay);
        });
        setMaCaChon((cu) => cu || ketQua[0]?.maCa || "");
        setLoi("");
      } catch (error) {
        if (hoatDong) setLoi(error instanceof Error ? error.message : "Không thể tải lịch.");
      } finally {
        if (hoatDong) {
          setDangTai(false);
          setDaKiemTra(true);
        }
      }
    }

    void taiLich();
    window.addEventListener("focus", taiLich);
    return () => {
      hoatDong = false;
      window.removeEventListener("focus", taiLich);
    };
  }, []);

  const dau = ngayChon ? (cheDo === "tuan" ? dauTuan(ngayChon) : ngayChon) : "";
  const soNgay = cheDo === "tuan" ? 7 : 1;
  const cacNgay = dau ? Array.from({ length: soNgay }, (_, i) => congNgay(dau, i)) : [];
  const danhSachNguoi = Array.from(new Map(cacCa.flatMap((ca) => ca.phanCong).map((pc) => [pc.maNhanSu, pc.hoTen])).entries()).sort((a, b) => a[1].localeCompare(b[1], "vi"));
  const cacCaHienThi = cacCa.filter((ca) => cacNgay.includes(ca.ngayLam.slice(0, 10)) && (!maNhanSuLoc || ca.phanCong.some((pc) => pc.maNhanSu === maNhanSuLoc)));
  const caChon = cacCa.find((ca) => ca.maCa === maCaChon);
  const tongCa = cacCaHienThi.length;
  const chuaPhanCong = cacCaHienThi.filter((ca) => ca.trangThai === "ChuaPhanCong").length;
  const daPhanCong = cacCaHienThi.filter((ca) => ca.trangThai === "DaPhanCong").length;

  function chuyenKhoang(huong: number) {
    if (!ngayChon) return;
    setNgayChon(congNgay(ngayChon, huong * soNgay));
  }

  async function dangNhap() {
    await khoiTaoKeycloak();
    await keycloak.login({ redirectUri: "http://localhost:3000/lich-lam-viec" });
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#849386]">Điều phối vận hành</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#30483a]">Lịch làm việc</h1>
          <p className="mt-2 text-sm text-[#748477]">Lịch ca theo ngày hoặc tuần, nhân sự và tình trạng phân công.</p>
        </div>
        <Link href="/phan-cong-ca" className="rounded-lg border border-[#d7e2d5] bg-white px-4 py-2.5 text-sm font-medium text-[#30483a] hover:bg-[#f5f8f3]">Phân công ca</Link>
      </div>

      {!daKiemTra ? (
        <div className="rounded-xl bg-white p-8 text-center text-sm text-[#748477]">Đang kiểm tra đăng nhập...</div>
      ) : !daDangNhap ? (
        <div className="rounded-xl border border-[#e2e9e0] bg-white p-8 text-center">
          <p className="mb-4 text-sm text-[#748477]">Bạn cần đăng nhập để xem lịch làm việc.</p>
          <button type="button" onClick={dangNhap} className="rounded-lg bg-[#30483a] px-5 py-3 text-sm font-semibold text-white">Đăng nhập</button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Tổng số ca", tongCa],
              ["Chưa phân công", chuaPhanCong],
              ["Đã phân công", daPhanCong],
            ].map(([ten, so]) => (
              <div key={String(ten)} className="rounded-xl border border-[#e2e9e0] bg-white px-5 py-4">
                <p className="text-xs text-[#859486]">{ten}</p>
                <p className="mt-2 text-3xl font-semibold text-[#30483a]">{dangTai ? "—" : so}</p>
              </div>
            ))}
          </div>

          {loi && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loi}</p>}

          <section className="overflow-hidden rounded-xl border border-[#e2e9e0] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edf1eb] p-5">
              <div>
                <h2 className="font-semibold text-[#30483a]">
                  {dau ? (cheDo === "tuan" ? `Tuần ${dinhDangNgay(dau)} – ${dinhDangNgay(congNgay(dau, 6))}` : `Ngày ${dinhDangNgay(dau)}`) : "Lịch vận hành"}
                </h2>
                <p className="mt-1 text-xs text-[#8b998d]">Ca sáng 06:00–14:00 · Ca chiều 14:00–22:00 (giờ chuẩn)</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" aria-label="Khoảng trước" onClick={() => chuyenKhoang(-1)} className="rounded-lg border border-[#dce5da] px-3 py-2">‹</button>
                <button type="button" aria-label="Khoảng sau" onClick={() => chuyenKhoang(1)} className="rounded-lg border border-[#dce5da] px-3 py-2">›</button>
                <button type="button" onClick={() => setNgayChon(ngayISO(new Date()))} className="rounded-lg border border-[#dce5da] px-3 py-2 text-sm">Hôm nay</button>
                <input type="date" aria-label="Chọn ngày xem lịch" value={ngayChon} onChange={(event) => setNgayChon(event.target.value)} className="rounded-lg border border-[#dce5da] px-3 py-2 text-sm" />
                <select aria-label="Lọc theo nhân viên" value={maNhanSuLoc} onChange={(event) => { setMaNhanSuLoc(event.target.value); setMaCaChon(""); }} className="rounded-lg border border-[#dce5da] px-3 py-2 text-sm">
                  <option value="">Tất cả nhân sự</option>
                  {danhSachNguoi.map(([ma, ten]) => <option key={ma} value={ma}>{ten} ({ma})</option>)}
                </select>
                <select aria-label="Kiểu xem lịch" value={cheDo} onChange={(event) => setCheDo(event.target.value as CheDo)} className="rounded-lg border border-[#dce5da] px-3 py-2 text-sm">
                  <option value="tuan">Theo tuần</option>
                  <option value="ngay">Theo ngày</option>
                </select>
              </div>
            </div>

            {dangTai ? (
              <p className="p-8 text-center text-sm text-[#839185]">Đang tải lịch...</p>
            ) : (
              <div className="overflow-x-auto p-4">
                <div className={cheDo === "tuan" ? "grid min-w-[950px] grid-cols-7 gap-3" : "grid grid-cols-1 gap-3 sm:grid-cols-2"}>
                  {cacNgay.map((ngay) => {
                    const cacCaTrongNgay = cacCaHienThi.filter((ca) => ca.ngayLam.slice(0, 10) === ngay);
                    const caSang = cacCaTrongNgay.find((ca) => tenCa(ca) === "Ca sáng");
                    const caChieu = cacCaTrongNgay.find((ca) => tenCa(ca) === "Ca chiều");
                    return (
                      <div key={ngay} className="rounded-lg border border-[#e8eee6] bg-[#f7f9f5] p-3">
                        <div className="mb-3 border-b border-[#e1e9de] pb-3">
                          <p className="text-xs font-semibold uppercase text-[#849586]">{tenNgay(ngay)}</p>
                          <p className="mt-1 text-sm font-semibold text-[#30483a]">{dinhDangNgay(ngay)}</p>
                        </div>
                        <div className="space-y-2">
                          {hienThiCa(caSang, caSang?.maCa === maCaChon, setMaCaChon, cheDo === "tuan", Boolean(maNhanSuLoc))}
                          {hienThiCa(caChieu, caChieu?.maCa === maCaChon, setMaCaChon, cheDo === "tuan", Boolean(maNhanSuLoc))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {cacNgay.length > 0 && cacCaHienThi.length === 0 && <p className="py-6 text-center text-sm text-[#839185]">Không có ca làm việc trong khoảng này.</p>}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[#e2e9e0] bg-white p-5 md:p-6">
            {!caChon ? (
              <p className="text-sm text-[#839185]">Chọn một ca trong lịch để xem thông tin phân công.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#edf1eb] pb-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#879688]">Chi tiết ca</p>
                    <h2 className="mt-2 text-xl font-semibold text-[#30483a]">{tenCa(caChon)} · {dinhDangNgay(caChon.ngayLam)}</h2>
                    <p className="mt-2 text-sm text-[#788a7b]">{caChon.maCa} · {caChon.gioBatDau.slice(0, 5)}–{caChon.gioKetThuc.slice(0, 5)}</p>
                  </div>
                  <span className="rounded-md bg-[#eef3eb] px-3 py-2 text-xs font-medium text-[#47684e]">{tenTrangThai(caChon.trangThai)} · {caChon.soNguoiDaPhanCong}/4</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {VI_TRI.map((viTri) => {
                    const nguoi = caChon.phanCong.find((item) => item.viTri === viTri);
                    return (
                      <div key={viTri} className="rounded-lg border border-[#e6ece4] bg-[#fafbf9] p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#829885]">{viTri}</p>
                        <p className="mt-3 text-sm font-semibold text-[#30483a]">{nguoi?.hoTen ?? "Chưa phân công"}</p>
                        <p className="mt-1 text-xs text-[#849286]">{nguoi ? `${nguoi.maNhanSu} · ${tenLoai(nguoi.loaiNhanSu)}` : "—"}</p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
