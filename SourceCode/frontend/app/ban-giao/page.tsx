"use client";

import { useEffect, useState } from "react";
import { keycloak, khoiTaoKeycloak } from "../../lib/keycloak";
import { layAccessToken } from "../../lib/auth-api";

const API = "http://localhost:3001";

type CaPhuTrach = {
  maCa: string;
  maPhanCongGiao: string;
  ngayLam: string;
  gioBatDau: string;
  gioKetThuc: string;
  coTheLap: number;
  soNhanVien: number;
  soViTriDaKiemTra: number;
  soSuCoTonDong: number;
  maCaTiepNhan: string | null;
  maPhanCongNhan: string | null;
  tenTruongCaNhan: string | null;
  maBienBan: string | null;
  trangThai: string | null;
  tongKetVanHanh: string | null;
  noiDungTonDong: string | null;
  canBoSung: boolean | number | null;
  ghiChuYeuCauBoSung: string | null;
  thoiGianLap: string | null;
  thoiGianCapNhat: string | null;
};

type BienBanNhan = {
  maBienBan: string;
  maCaBanGiao: string;
  maCaTiepNhan: string;
  ngayBanGiao: string;
  tenTruongCaGiao: string;
  tongKetVanHanh: string;
  noiDungTonDong: string | null;
  trangThai: string;
  canBoSung: boolean | number;
  ghiChuYeuCauBoSung: string | null;
  thoiGianLap: string;
  thoiGianTiepNhan: string | null;
  coTheTiepNhan: number;
};

type Checklist = {
  viTri: string;
  nguoiKiemTra: string;
  maLan: string | null;
  thoiGianHoanTat: string | null;
  soDat: number;
  soKhongDat: number;
  noiDungCanLuuY: string | null;
};

type SuCo = {
  maSuCo: string;
  noiDung: string;
  mucDo: string;
  trangThai: string;
  canBanGiaoCaSau: boolean | number;
  viTriPhatSinh: string | null;
};

type DuLieu = {
  caPhuTrach: CaPhuTrach[];
  bienBanCanNhan: BienBanNhan[];
};

type ChiTiet = { checklist: Checklist[]; suCo: SuCo[] };
type NhomTrang = "lap" | "nhan";

function ngayVN(value: string | null | undefined) {
  if (!value) return "—";
  const v = value.slice(0, 10).split("-");
  return v.length === 3 ? `${v[2]}/${v[1]}/${v[0]}` : value;
}

function moTaTrangThai(value: string | null | undefined, canBoSung?: boolean | number | null) {
  if (value === "DaTiepNhan") return "Đã tiếp nhận";
  if (Number(canBoSung) === 1) return "Cần bổ sung";
  if (value === "ChoTiepNhan") return "Chờ tiếp nhận";
  return "Chưa lập";
}

function docLoi(value: unknown, status: number) {
  if (value && typeof value === "object" && "message" in value) {
    const msg = (value as { message?: string | string[] }).message;
    if (typeof msg === "string") return msg;
    if (Array.isArray(msg)) return msg.join("; ");
  }
  return `Không thực hiện được yêu cầu (HTTP ${status}).`;
}

async function goiApi<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const token = await layAccessToken();
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(docLoi(data, response.status));
  return data as T;
}

export default function BanGiaoCaPage() {
  const [trang, setTrang] = useState<NhomTrang>("lap");
  const [dangTai, setDangTai] = useState(true);
  const [daDangNhap, setDaDangNhap] = useState(false);
  const [dangLuu, setDangLuu] = useState(false);
  const [duLieu, setDuLieu] = useState<DuLieu>({ caPhuTrach: [], bienBanCanNhan: [] });
  const [maCaChon, setMaCaChon] = useState("");
  const [maBienBanChon, setMaBienBanChon] = useState("");
  const [chiTiet, setChiTiet] = useState<ChiTiet>({ checklist: [], suCo: [] });
  const [dangTaiChiTiet, setDangTaiChiTiet] = useState(false);
  const [tongKet, setTongKet] = useState("");
  const [tonDong, setTonDong] = useState("");
  const [luaChon, setLuaChon] = useState<"DaTiepNhan" | "CanBoSung">("DaTiepNhan");
  const [ghiChuPhanHoi, setGhiChuPhanHoi] = useState("");
  const [loi, setLoi] = useState("");
  const [thongBao, setThongBao] = useState("");

  async function taiDanhSach() {
    const data = await goiApi<DuLieu>("/ban-giao-ca/du-lieu");
    setDuLieu(data);
    setMaCaChon((cu) => cu && data.caPhuTrach.some((ca) => ca.maCa === cu)
      ? cu : data.caPhuTrach.find((ca) => Number(ca.coTheLap) === 1)?.maCa
      ?? data.caPhuTrach[0]?.maCa ?? "");
    setMaBienBanChon((cu) => cu && data.bienBanCanNhan.some((bb) => bb.maBienBan === cu)
      ? cu : data.bienBanCanNhan.find((bb) => bb.trangThai === "ChoTiepNhan")?.maBienBan
      ?? data.bienBanCanNhan[0]?.maBienBan ?? "");
  }

  useEffect(() => {
    let hoatDong = true;
    async function khoiTao() {
      try {
        const auth = await khoiTaoKeycloak();
        if (!hoatDong) return;
        setDaDangNhap(auth);
        if (!auth) return;
        await taiDanhSach();
      } catch (error) {
        if (hoatDong) setLoi(error instanceof Error ? error.message : "Không tải được dữ liệu bàn giao ca.");
      } finally {
        if (hoatDong) setDangTai(false);
      }
    }
    void khoiTao();
    return () => { hoatDong = false; };
  }, []);

  const caChon = duLieu.caPhuTrach.find((ca) => ca.maCa === maCaChon);
  const bienBanChon = duLieu.bienBanCanNhan.find((bb) => bb.maBienBan === maBienBanChon);
  const maCaChiTiet = trang === "lap" ? caChon?.maCa : bienBanChon?.maCaBanGiao;

  useEffect(() => {
    let hoatDong = true;
    if (!maCaChiTiet) {
      setChiTiet({ checklist: [], suCo: [] });
      return;
    }
    setDangTaiChiTiet(true);
    void goiApi<ChiTiet>(`/ban-giao-ca/thong-tin-ca/${encodeURIComponent(maCaChiTiet)}`)
      .then((data) => { if (hoatDong) setChiTiet(data); })
      .catch((error) => {
        if (hoatDong) {
          setChiTiet({ checklist: [], suCo: [] });
          setLoi(error instanceof Error ? error.message : "Không tải được thông tin ca.");
        }
      })
      .finally(() => { if (hoatDong) setDangTaiChiTiet(false); });
    return () => { hoatDong = false; };
  }, [maCaChiTiet]);

  function chonCa(ma: string) {
    const ca = duLieu.caPhuTrach.find((item) => item.maCa === ma);
    setMaCaChon(ma);
    setTongKet(ca?.tongKetVanHanh ?? "");
    setTonDong(ca?.noiDungTonDong ?? "");
    setLoi("");
    setThongBao("");
  }

  function chonBienBan(ma: string) {
    setMaBienBanChon(ma);
    setLuaChon("DaTiepNhan");
    setGhiChuPhanHoi("");
    setLoi("");
    setThongBao("");
  }

  useEffect(() => {
    if (!caChon) return;
    setTongKet(caChon.tongKetVanHanh ?? "");
    setTonDong(caChon.noiDungTonDong ?? "");
  }, [maCaChon, caChon?.tongKetVanHanh, caChon?.noiDungTonDong]);

  async function lapBienBan() {
    if (!caChon || dangLuu) return;
    if (!window.confirm(`Lưu biên bản bàn giao ca ${caChon.maCa} sang ca ${caChon.maCaTiepNhan}?`)) return;
    setDangLuu(true);
    setLoi("");
    setThongBao("");
    try {
      const ketQua = await goiApi<{ thongBao: string }>("/ban-giao-ca/lap", "POST", {
        maCaBanGiao: caChon.maCa,
        tongKetVanHanh: tongKet.trim(),
        noiDungTonDong: tonDong.trim(),
      });
      setThongBao(ketQua.thongBao);
      try { await taiDanhSach(); } catch { setThongBao(`${ketQua.thongBao}. Hãy tải lại trang để cập nhật danh sách.`); }
    } catch (error) {
      setLoi(error instanceof Error ? error.message : "Không thể lập biên bản.");
    } finally {
      setDangLuu(false);
    }
  }

  async function phanHoi() {
    if (!bienBanChon || dangLuu) return;
    const thaoTac = luaChon === "DaTiepNhan" ? "xác nhận tiếp nhận" : "yêu cầu bổ sung";
    if (!window.confirm(`Bạn muốn ${thaoTac} biên bản ${bienBanChon.maBienBan}?`)) return;
    setDangLuu(true);
    setLoi("");
    setThongBao("");
    try {
      const ketQua = await goiApi<{ thongBao: string }>("/ban-giao-ca/phan-hoi", "POST", {
        maBienBan: bienBanChon.maBienBan,
        ketQua: luaChon,
        ghiChu: ghiChuPhanHoi.trim(),
      });
      setThongBao(ketQua.thongBao);
      setGhiChuPhanHoi("");
      try { await taiDanhSach(); } catch { setThongBao(`${ketQua.thongBao}. Hãy tải lại trang để cập nhật danh sách.`); }
    } catch (error) {
      setLoi(error instanceof Error ? error.message : "Không thể xử lý biên bản.");
    } finally {
      setDangLuu(false);
    }
  }

  async function dangNhap() {
    try {
      await khoiTaoKeycloak();
      await keycloak.login({ redirectUri: `${window.location.origin}/ban-giao` });
    } catch {
      setLoi("Không thể chuyển đến trang đăng nhập.");
    }
  }

  const choPhepLap = Boolean(caChon && !dangLuu && caChon.maPhanCongNhan &&
    Number(caChon.soNhanVien) === 4 &&
    (caChon.maBienBan
      ? caChon.trangThai === "ChoTiepNhan" && Number(caChon.canBoSung) === 1
      : Number(caChon.coTheLap) === 1) &&
    tongKet.trim().length >= 10 &&
    (Number(caChon.soSuCoTonDong) === 0 || tonDong.trim().length >= 10));
  const choPhepPhanHoi = Boolean(bienBanChon && !dangLuu &&
    Number(bienBanChon.coTheTiepNhan) === 1 && bienBanChon.trangThai === "ChoTiepNhan" &&
    Number(bienBanChon.canBoSung) !== 1 &&
    (luaChon !== "CanBoSung" || ghiChuPhanHoi.trim().length >= 5));

  return (
    <main className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#849386]">ĐIỀU PHỐI VẬN HÀNH</p>
        <h1 className="text-3xl font-semibold text-[#30483a]">Biên bản bàn giao ca</h1>
        <p className="mt-2 text-sm text-[#748477]">Trưởng ca tổng hợp tình hình vận hành và xác nhận bàn giao giữa hai ca liên tiếp.</p>
      </div>

      {loi && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loi}</div>}
      {thongBao && <div role="status" className="rounded-xl border border-[#d3e4d2] bg-[#edf7eb] p-4 text-sm text-[#3d6342]">{thongBao}</div>}

      {dangTai ? (
        <section className="rounded-xl border border-[#e2e9e0] bg-white p-6 text-sm text-[#748477]">Đang tải dữ liệu bàn giao ca...</section>
      ) : !daDangNhap ? (
        <section className="rounded-xl border border-[#e2e9e0] bg-white p-6">
          <p className="mb-4 text-sm text-[#748477]">Bạn cần đăng nhập để xem các biên bản.</p>
          <button type="button" onClick={() => void dangNhap()} className="rounded-lg bg-[#30483a] px-5 py-3 text-sm font-semibold text-white">Đăng nhập</button>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 rounded-xl border border-[#e0e8dd] bg-white p-2">
            <button type="button" onClick={() => { setTrang("lap"); setLoi(""); setThongBao(""); }} className={`rounded-lg px-5 py-3 text-sm font-semibold ${trang === "lap" ? "bg-[#30483a] text-white" : "text-[#637966] hover:bg-[#f0f4ee]"}`}>Lập biên bản bàn giao</button>
            <button type="button" onClick={() => { setTrang("nhan"); setLoi(""); setThongBao(""); }} className={`rounded-lg px-5 py-3 text-sm font-semibold ${trang === "nhan" ? "bg-[#30483a] text-white" : "text-[#637966] hover:bg-[#f0f4ee]"}`}>Xác nhận tiếp nhận ({duLieu.bienBanCanNhan.filter((bb) => bb.trangThai === "ChoTiepNhan").length})</button>
          </div>

          {trang === "lap" ? (
            duLieu.caPhuTrach.length === 0 ? (
              <section className="rounded-xl border border-[#e2e9e0] bg-white p-6 text-sm text-[#748477]">Bạn chưa được phân công làm Trưởng ca trong khoảng thời gian hiển thị. Chức năng này không dành cho các vị trí khác.</section>
            ) : (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <section className="self-start space-y-5 rounded-xl border border-[#e2e9e0] bg-white p-5 md:p-6">
                  <h2 className="text-lg font-semibold text-[#30483a]">Ca tôi phụ trách</h2>
                  <div>
                    <label htmlFor="ca-ban-giao" className="mb-2 block text-sm font-medium text-[#455a48]">Chọn ca bàn giao</label>
                    <select id="ca-ban-giao" value={maCaChon} onChange={(e) => chonCa(e.target.value)} className="w-full rounded-lg border border-[#d9e4d7] bg-white p-3 text-sm text-[#30483a]">
                      {duLieu.caPhuTrach.map((ca) => <option key={ca.maCa} value={ca.maCa}>{ca.maCa} · {ngayVN(ca.ngayLam)} · {ca.gioBatDau.slice(0,5)}–{ca.gioKetThuc.slice(0,5)}</option>)}
                    </select>
                  </div>
                  {caChon && (
                    <div className="space-y-2 rounded-lg bg-[#f2f6f0] p-4 text-sm text-[#526b56]">
                      <p><span className="font-semibold text-[#30483a]">Ca tiếp nhận:</span> {caChon.maCaTiepNhan ?? "Chưa tìm thấy ca kế tiếp"}</p>
                      <p><span className="font-semibold text-[#30483a]">Trưởng ca nhận:</span> {caChon.tenTruongCaNhan ?? "Chưa phân công"}</p>
                      <p><span className="font-semibold text-[#30483a]">Nhân sự:</span> {caChon.soNhanVien}/4 người</p>
                      <p><span className="font-semibold text-[#30483a]">Checklist:</span> {caChon.soViTriDaKiemTra}/3 vị trí đã hoàn tất</p>
                      <p><span className="font-semibold text-[#30483a]">Sự cố cần theo dõi:</span> {caChon.soSuCoTonDong}</p>
                      <p><span className="font-semibold text-[#30483a]">Biên bản:</span> {moTaTrangThai(caChon.trangThai,caChon.canBoSung)}</p>
                      {caChon.ghiChuYeuCauBoSung && <p className="rounded-lg bg-amber-50 p-3 text-amber-800"><span className="font-semibold">Yêu cầu bổ sung:</span> {caChon.ghiChuYeuCauBoSung}</p>}
                    </div>
                  )}
                  {caChon?.maBienBan && Number(caChon.canBoSung) !== 1 && (
                    <p className="rounded-lg bg-[#edf3e9] p-4 text-sm text-[#58705b]">Biên bản đã được lập. Chỉ được cập nhật khi Trưởng ca tiếp nhận yêu cầu bổ sung.</p>
                  )}
                  {!caChon?.maBienBan && Number(caChon?.coTheLap) !== 1 && <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Chỉ lập biên bản trong giờ ca đang làm việc.</p>}
                  <div>
                    <label htmlFor="tong-ket-van-hanh" className="mb-2 block text-sm font-medium text-[#455a48]">Tổng kết vận hành *</label>
                    <textarea id="tong-ket-van-hanh" rows={5} maxLength={5000} value={tongKet} onChange={(e) => setTongKet(e.target.value)} placeholder="Tình hình phục vụ, nhân sự, công việc đã hoàn tất..." className="w-full rounded-lg border border-[#d9e4d7] p-3 text-sm text-[#30483a]" />
                  </div>
                  <div>
                    <label htmlFor="noi-dung-ton-dong" className="mb-2 block text-sm font-medium text-[#455a48]">Công việc tồn đọng và lưu ý ca sau {Number(caChon?.soSuCoTonDong) > 0 ? "*" : ""}</label>
                    <textarea id="noi-dung-ton-dong" rows={5} maxLength={5000} value={tonDong} onChange={(e) => setTonDong(e.target.value)} placeholder="Mô tả vấn đề chưa xử lý xong, hoặc ghi rõ không có nội dung tồn đọng." className="w-full rounded-lg border border-[#d9e4d7] p-3 text-sm text-[#30483a]" />
                    {Number(caChon?.soSuCoTonDong) > 0 && <p className="mt-1 text-xs text-amber-700">Ca có sự cố cần theo dõi, vui lòng mô tả ít nhất 10 ký tự.</p>}
                  </div>
                  <button type="button" disabled={!choPhepLap} onClick={() => void lapBienBan()} className="w-full rounded-lg bg-[#30483a] px-5 py-3 font-semibold text-white hover:bg-[#45664d] disabled:cursor-not-allowed disabled:opacity-45">{dangLuu ? "Đang lưu..." : caChon?.maBienBan ? "Lưu nội dung bổ sung" : "Lập biên bản bàn giao"}</button>
                </section>
                <ThongTinVanHanh chiTiet={chiTiet} dangTai={dangTaiChiTiet} />
              </div>
            )
          ) : duLieu.bienBanCanNhan.length === 0 ? (
            <section className="rounded-xl border border-[#e2e9e0] bg-white p-6 text-sm text-[#748477]">Chưa có biên bản nào từ Trưởng ca trước gửi đến bạn.</section>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <section className="self-start space-y-5 rounded-xl border border-[#e2e9e0] bg-white p-5 md:p-6">
                <h2 className="text-lg font-semibold text-[#30483a]">Biên bản chờ tiếp nhận</h2>
                <div>
                  <label htmlFor="bien-ban-nhan" className="mb-2 block text-sm font-medium text-[#455a48]">Chọn biên bản</label>
                  <select id="bien-ban-nhan" value={maBienBanChon} onChange={(e) => chonBienBan(e.target.value)} className="w-full rounded-lg border border-[#d9e4d7] bg-white p-3 text-sm text-[#30483a]">
                    {duLieu.bienBanCanNhan.map((bb) => <option key={bb.maBienBan} value={bb.maBienBan}>{bb.maCaBanGiao} → {bb.maCaTiepNhan} · {moTaTrangThai(bb.trangThai,bb.canBoSung)}</option>)}
                  </select>
                </div>
                {bienBanChon && (
                  <div className="space-y-3 text-sm text-[#536956]">
                    <p><span className="font-semibold text-[#30483a]">Người giao:</span> {bienBanChon.tenTruongCaGiao}</p>
                    <p><span className="font-semibold text-[#30483a]">Ca giao:</span> {bienBanChon.maCaBanGiao} · {ngayVN(bienBanChon.ngayBanGiao)}</p>
                    <p><span className="font-semibold text-[#30483a]">Lập lúc:</span> {bienBanChon.thoiGianLap}</p>
                    <p><span className="font-semibold text-[#30483a]">Trạng thái:</span> {moTaTrangThai(bienBanChon.trangThai,bienBanChon.canBoSung)}</p>
                    <div className="rounded-lg bg-[#f4f7f2] p-4"><h3 className="font-semibold text-[#30483a]">Tổng kết vận hành</h3><p className="mt-2 whitespace-pre-wrap">{bienBanChon.tongKetVanHanh}</p></div>
                    <div className="rounded-lg bg-[#f4f7f2] p-4"><h3 className="font-semibold text-[#30483a]">Công việc tồn đọng</h3><p className="mt-2 whitespace-pre-wrap">{bienBanChon.noiDungTonDong || "Không ghi nhận nội dung tồn đọng."}</p></div>
                    {bienBanChon.ghiChuYeuCauBoSung && <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">Ghi chú bổ sung gần nhất: {bienBanChon.ghiChuYeuCauBoSung}</p>}
                  </div>
                )}
                {bienBanChon?.trangThai === "DaTiepNhan" ? (
                  <p className="rounded-lg bg-[#edf7eb] p-4 text-sm text-[#3d6342]">Đã tiếp nhận lúc {bienBanChon.thoiGianTiepNhan}. Không thể xác nhận lại.</p>
                ) : Number(bienBanChon?.canBoSung) === 1 ? (
                  <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Đang chờ Trưởng ca trước bổ sung. Bạn không thể xác nhận cho đến khi biên bản được cập nhật.</p>
                ) : (
                  <>
                    <div className="grid gap-2 md:grid-cols-2">
                      <button type="button" onClick={() => setLuaChon("DaTiepNhan")} className={`rounded-lg border p-4 text-left text-sm font-semibold ${luaChon === "DaTiepNhan" ? "border-[#85aa88] bg-[#edf7eb] text-[#34633b]" : "border-[#d9e4d7] text-[#5e7662]"}`}>Đồng ý tiếp nhận</button>
                      <button type="button" onClick={() => setLuaChon("CanBoSung")} className={`rounded-lg border p-4 text-left text-sm font-semibold ${luaChon === "CanBoSung" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-[#d9e4d7] text-[#5e7662]"}`}>Yêu cầu bổ sung</button>
                    </div>
                    {luaChon === "CanBoSung" && (
                      <div>
                        <label htmlFor="ghi-chu-phan-hoi" className="mb-2 block text-sm font-medium text-[#455a48]">Nội dung cần bổ sung *</label>
                        <textarea id="ghi-chu-phan-hoi" value={ghiChuPhanHoi} onChange={(e) => setGhiChuPhanHoi(e.target.value)} maxLength={500} rows={4} placeholder="Nêu rõ thông tin chưa đúng hoặc cần làm rõ..." className="w-full rounded-lg border border-[#d9e4d7] p-3 text-sm text-[#30483a]" />
                      </div>
                    )}
                    {Number(bienBanChon?.coTheTiepNhan) !== 1 && <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Chỉ phản hồi khi ca tiếp nhận đang trong giờ làm việc.</p>}
                    <button type="button" disabled={!choPhepPhanHoi} onClick={() => void phanHoi()} className="w-full rounded-lg bg-[#30483a] px-5 py-3 font-semibold text-white hover:bg-[#45664d] disabled:cursor-not-allowed disabled:opacity-45">{dangLuu ? "Đang lưu..." : luaChon === "DaTiepNhan" ? "Xác nhận tiếp nhận" : "Gửi yêu cầu bổ sung"}</button>
                  </>
                )}
              </section>
              <ThongTinVanHanh chiTiet={chiTiet} dangTai={dangTaiChiTiet} />
            </div>
          )}
        </>
      )}
    </main>
  );
}

function ThongTinVanHanh({ chiTiet, dangTai }: { chiTiet: ChiTiet; dangTai: boolean }) {
  return (
    <section className="self-start space-y-5 rounded-xl border border-[#e2e9e0] bg-white p-5 md:p-6">
      <div><h2 className="text-lg font-semibold text-[#30483a]">Thông tin vận hành ca bàn giao</h2><p className="mt-1 text-sm text-[#748477]">Dữ liệu Checklist và sự cố để Trưởng ca đối chiếu trước khi lập hoặc nhận biên bản.</p></div>
      {dangTai ? <p className="text-sm text-[#748477]">Đang tải tình hình ca...</p> : (
        <>
          <div>
            <h3 className="mb-3 font-semibold text-[#30483a]">Checklist theo vị trí</h3>
            {chiTiet.checklist.length === 0 ? <p className="text-sm text-[#748477]">Chưa có dữ liệu phân công.</p> : (
              <div className="space-y-2">
                {chiTiet.checklist.map((ck) => (
                  <div key={ck.viTri} className="rounded-lg border border-[#e4ebe2] p-4 text-sm text-[#536955]">
                    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-[#30483a]">{ck.viTri}</span><span className={`rounded-full px-2.5 py-1 text-xs ${ck.maLan ? "bg-[#e9f4e7] text-[#397044]" : "bg-amber-50 text-amber-700"}`}>{ck.maLan ? "Đã kiểm tra" : "Chưa hoàn tất"}</span></div>
                    <p className="mt-2">{ck.nguoiKiemTra}</p>
                    {ck.maLan && <p className="mt-1">{ck.soDat} đạt · {ck.soKhongDat} không đạt · {ck.thoiGianHoanTat}</p>}
                    {ck.noiDungCanLuuY && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Cần lưu ý: {ck.noiDungCanLuuY}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3 className="mb-3 font-semibold text-[#30483a]">Sự cố phát sinh</h3>
            {chiTiet.suCo.length === 0 ? <p className="text-sm text-[#748477]">Không có sự cố được ghi nhận trong ca.</p> : (
              <div className="space-y-2">
                {chiTiet.suCo.map((sc) => (
                  <div key={sc.maSuCo} className="rounded-lg border border-[#e4ebe2] p-4 text-sm text-[#536955]">
                    <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-[#edf3e9] px-2.5 py-1">{sc.mucDo === "QuanTrong" ? "Quan trọng" : "Thông thường"}</span><span className="rounded-full bg-[#edf3e9] px-2.5 py-1">{sc.trangThai === "DaXuLy" ? "Đã xử lý" : sc.trangThai === "DangXuLy" ? "Đang xử lý" : "Chưa hoàn thành"}</span></div>
                    <p className="mt-2 whitespace-pre-wrap text-[#30483a]">{sc.noiDung}</p>
                    {(sc.trangThai !== "DaXuLy" || Number(sc.canBanGiaoCaSau) === 1) && <p className="mt-2 text-xs font-semibold text-amber-800">Cần lưu ý trong bàn giao</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
