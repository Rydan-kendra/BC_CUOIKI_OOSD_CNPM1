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
};

type CaCuaToi = Ca & {
  maPhanCongGoc: string;
  viTri: string;
};

type CaDeXuat = Ca & { trangThai: string };

type YeuCau = {
  maYeuCau: string;
  maCaGoc: string;
  maCaDeXuat: string;
  ngayCaGoc: string;
  ngayCaDeXuat: string;
  gioCaGoc: string;
  gioCaDeXuat: string;
  trangThai: string;
  lyDo: string;
  lyDoTuChoi: string | null;
  thoiGianGui: string;
};

type DuLieu = {
  caCuaToi: CaCuaToi[];
  caDeXuat: CaDeXuat[];
  yeuCauCuaToi: YeuCau[];
};

function ngayVN(iso: string) {
  const [nam, thang, ngay] = iso.slice(0, 10).split("-");
  return `${ngay}/${thang}/${nam}`;
}

function tenCa(ca: Ca) {
  return ca.gioBatDau.slice(0, 5) < "14:00" ? "Ca sáng" : "Ca chiều";
}

function moTaCa(ca: Ca) {
  return `${ngayVN(ca.ngayLam)} · ${tenCa(ca)} (${ca.gioBatDau.slice(0, 5)}–${ca.gioKetThuc.slice(0, 5)}) · ${ca.maCa}`;
}

function tenTrangThai(trangThai: string) {
  const bang: Record<string, string> = {
    ChoXetDuyet: "Chờ xét duyệt",
    DaChapThuan: "Đã chấp thuận",
    DaTuChoi: "Đã từ chối",
  };
  return bang[trangThai] ?? trangThai;
}

function layLoiApi(data: unknown, status: number) {
  if (typeof data === "object" && data !== null && "message" in data) {
    const message = (data as { message?: string | string[] }).message;
    if (Array.isArray(message)) return message.join("; ");
    if (typeof message === "string") return message;
  }
  return `Yêu cầu thất bại (HTTP ${status}).`;
}

export default function YeuCauDoiCaPage() {
  const [duLieu, setDuLieu] = useState<DuLieu>({ caCuaToi: [], caDeXuat: [], yeuCauCuaToi: [] });
  const [daKiemTra, setDaKiemTra] = useState(false);
  const [daDangNhap, setDaDangNhap] = useState(false);
  const [laNhanVien, setLaNhanVien] = useState(false);
  const [dangTai, setDangTai] = useState(false);
  const [dangGui, setDangGui] = useState(false);
  const [maPhanCongGoc, setMaPhanCongGoc] = useState("");
  const [maCaDeXuat, setMaCaDeXuat] = useState("");
  const [lyDo, setLyDo] = useState("");
  const [loi, setLoi] = useState("");
  const [thongBao, setThongBao] = useState("");

  async function napDuLieu() {
    const token = await layAccessToken();
    const response = await fetch(`${API}/yeu-cau-doi-ca/du-lieu`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(layLoiApi(data, response.status));
    const ketQua = data as DuLieu;
    setDuLieu(ketQua);
    return ketQua;
  }

  useEffect(() => {
    let hoatDong = true;
    async function khoiTao() {
      try {
        const authenticated = await khoiTaoKeycloak();
        if (!hoatDong) return;
        setDaDangNhap(authenticated);
        const roleNhanVien = authenticated && keycloak.hasRealmRole("NhanVien");
        setLaNhanVien(roleNhanVien);
        setDaKiemTra(true);
        if (!roleNhanVien) return;
        setDangTai(true);
        const token = await layAccessToken();
        const response = await fetch(`${API}/yeu-cau-doi-ca/du-lieu`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data: unknown = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(layLoiApi(data, response.status));
        if (!hoatDong) return;
        const ketQua = data as DuLieu;
        setDuLieu(ketQua);
        if (ketQua.caCuaToi[0]) setMaPhanCongGoc(ketQua.caCuaToi[0].maPhanCongGoc);
      } catch (error) {
        if (hoatDong) setLoi(error instanceof Error ? error.message : "Không thể tải yêu cầu đổi ca.");
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

  const caGoc = useMemo(
    () => duLieu.caCuaToi.find((ca) => ca.maPhanCongGoc === maPhanCongGoc),
    [duLieu.caCuaToi, maPhanCongGoc],
  );

  const cacCaDeXuat = useMemo(
    () => duLieu.caDeXuat.filter((ca) => ca.maCa !== caGoc?.maCa),
    [duLieu.caDeXuat, caGoc?.maCa],
  );

  const coYeuCauChoDuyet = duLieu.yeuCauCuaToi.some(
    (yc) => yc.trangThai === "ChoXetDuyet" && yc.maCaGoc === caGoc?.maCa,
  );

  async function dangNhap() {
    await khoiTaoKeycloak();
    await keycloak.login({ redirectUri: "http://localhost:3000/yeu-cau-doi-ca" });
  }

  async function guiYeuCau() {
    setLoi("");
    setThongBao("");
    if (!maPhanCongGoc || !maCaDeXuat || lyDo.trim().length < 5) {
      setLoi("Vui lòng chọn ca gốc, ca đề xuất và nhập lý do tối thiểu 5 ký tự.");
      return;
    }
    setDangGui(true);
    try {
      const token = await layAccessToken();
      const response = await fetch(`${API}/yeu-cau-doi-ca/gui`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ maPhanCongGoc, maCaDeXuat, lyDo: lyDo.trim() }),
      });
      const result: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(layLoiApi(result, response.status));
      setThongBao("Gửi yêu cầu thành công. Lịch làm việc chưa thay đổi.");
      setLyDo("");
      setMaCaDeXuat("");
    } catch (error) {
      setLoi(error instanceof Error ? error.message : "Không thể gửi yêu cầu đổi ca.");
      setDangGui(false);
      return;
    }
    try {
      await napDuLieu();
    } catch {
      setThongBao("Đã gửi yêu cầu thành công, nhưng chưa tải lại được danh sách. Vui lòng mở lại trang.");
    } finally {
      setDangGui(false);
    }
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#849386]">Điều phối vận hành</p>
          <h1 className="text-3xl font-semibold text-[#30483a]">Yêu cầu đổi ca</h1>
          <p className="mt-2 text-sm text-[#748477]">Gửi đề nghị thay đổi ca và theo dõi trạng thái xét duyệt.</p>
        </div>
        <Link href="/lich-lam-viec" className="rounded-lg border border-[#d6e0d5] bg-white px-4 py-2.5 text-sm text-[#30483a]">Xem lịch làm việc</Link>
      </div>

      {!daKiemTra ? (
        <section className="rounded-xl bg-white p-7 text-sm text-[#738576]">Đang kiểm tra đăng nhập...</section>
      ) : !daDangNhap ? (
        <section className="rounded-xl border border-[#e2e9e0] bg-white p-8 text-center">
          <p className="mb-4 text-sm text-[#748477]">Bạn cần đăng nhập để gửi yêu cầu đổi ca.</p>
          <button onClick={dangNhap} type="button" className="rounded-lg bg-[#30483a] px-5 py-3 text-sm font-semibold text-white">Đăng nhập</button>
        </section>
      ) : !laNhanVien ? (
        <section className="space-y-4 rounded-xl border border-[#e2e9e0] bg-white p-8 text-sm text-[#748477]">
          <p>Phần gửi yêu cầu dành cho nhân viên. Quản lý có thể xem và xử lý các yêu cầu đang chờ.</p>
          <Link href="/xu-ly-doi-ca" className="inline-flex rounded-lg bg-[#30483a] px-5 py-3 font-semibold text-white">Đi đến trang xét duyệt yêu cầu</Link>
        </section>
      ) : (
        <>
          {loi && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loi}</p>}
          {thongBao && <p role="status" className="rounded-lg border border-[#d5e4d2] bg-[#f2f7ef] p-4 text-sm text-[#365d3c]">{thongBao}</p>}
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <section className="rounded-xl border border-[#e2e9e0] bg-white p-5 md:p-6">
              <h2 className="text-lg font-semibold text-[#30483a]">Tạo yêu cầu đổi ca</h2>
              <p className="mt-1 text-sm text-[#839185]">Chỉ những ca đã phân công cho bạn mới xuất hiện trong danh sách ca hiện tại.</p>
              {dangTai ? (
                <p className="mt-6 text-sm text-[#748477]">Đang tải dữ liệu...</p>
              ) : duLieu.caCuaToi.length === 0 ? (
                <p className="mt-6 rounded-lg bg-[#f2f6f0] p-4 text-sm text-[#647866]">Bạn chưa có ca được phân công sắp tới để gửi yêu cầu.</p>
              ) : (
                <div className="mt-6 space-y-5">
                  <div>
                    <label htmlFor="ca-goc" className="mb-2 block text-sm font-semibold text-[#30483a]">Ca đang được phân công</label>
                    <select id="ca-goc" value={maPhanCongGoc} onChange={(e) => { setMaPhanCongGoc(e.target.value); setMaCaDeXuat(""); }} className="w-full rounded-lg border border-[#dce5da] bg-white px-3 py-3 text-sm text-[#30483a]">
                      {duLieu.caCuaToi.map((ca) => <option key={ca.maPhanCongGoc} value={ca.maPhanCongGoc}>{moTaCa(ca)} · {ca.viTri}</option>)}
                    </select>
                    {caGoc && <p className="mt-2 text-xs text-[#839185]">Vị trí hiện tại: {caGoc.viTri}</p>}
                  </div>
                  <div>
                    <label htmlFor="ca-de-xuat" className="mb-2 block text-sm font-semibold text-[#30483a]">Ca đề xuất thay thế</label>
                    <select id="ca-de-xuat" value={maCaDeXuat} onChange={(e) => setMaCaDeXuat(e.target.value)} className="w-full rounded-lg border border-[#dce5da] bg-white px-3 py-3 text-sm text-[#30483a]">
                      <option value="">-- Chọn ca đề xuất --</option>
                      {cacCaDeXuat.map((ca) => <option key={ca.maCa} value={ca.maCa}>{moTaCa(ca)} · {ca.trangThai === "ChuaPhanCong" ? "Chưa phân công" : "Đã phân công"}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="ly-do" className="mb-2 block text-sm font-semibold text-[#30483a]">Lý do đổi ca</label>
                    <textarea id="ly-do" value={lyDo} maxLength={500} rows={5} onChange={(e) => setLyDo(e.target.value)} placeholder="Ví dụ: Có lịch học vào buổi sáng, mong được chuyển sang ca chiều." className="w-full resize-y rounded-lg border border-[#dce5da] bg-white px-3 py-3 text-sm text-[#30483a] outline-none focus:border-[#64846a]" />
                    <p className="mt-1 text-right text-xs text-[#839185]">{lyDo.length}/500 ký tự</p>
                  </div>
                  <div className="rounded-lg bg-[#f1f6ef] p-4 text-sm leading-6 text-[#617967]">Yêu cầu cần được Quản lý xét duyệt. Gửi yêu cầu không tự động thay đổi lịch đã phân công.</div>
                  {coYeuCauChoDuyet && <p className="text-sm text-amber-700">Bạn đang có yêu cầu chờ duyệt cho ca này.</p>}
                  <button type="button" onClick={guiYeuCau} disabled={dangGui || coYeuCauChoDuyet || !maCaDeXuat || lyDo.trim().length < 5} className="rounded-lg bg-[#30483a] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#476650] disabled:cursor-not-allowed disabled:opacity-40">
                    {dangGui ? "Đang gửi..." : "Gửi yêu cầu"}
                  </button>
                </div>
              )}
            </section>
            <section className="rounded-xl border border-[#e2e9e0] bg-white p-5 md:p-6">
              <h2 className="text-lg font-semibold text-[#30483a]">Yêu cầu đã gửi</h2>
              <p className="mt-1 text-sm text-[#839185]">Xem lịch sử và trạng thái yêu cầu của bạn.</p>
              <div className="mt-5 space-y-3">
                {duLieu.yeuCauCuaToi.map((yc) => (
                  <article key={yc.maYeuCau} className="rounded-lg border border-[#e1e8df] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#30483a]">{yc.maYeuCau}</p>
                      <span className="rounded-md bg-[#edf3ea] px-3 py-1.5 text-xs font-medium text-[#456b4c]">{tenTrangThai(yc.trangThai)}</span>
                    </div>
                    <p className="mt-3 text-sm text-[#4e6253]">Ca gốc: {yc.maCaGoc} · {ngayVN(yc.ngayCaGoc)} · {yc.gioCaGoc.slice(0, 5)}</p>
                    <p className="mt-1 text-sm text-[#4e6253]">Đề xuất: {yc.maCaDeXuat} · {ngayVN(yc.ngayCaDeXuat)} · {yc.gioCaDeXuat.slice(0, 5)}</p>
                    <p className="mt-2 text-sm text-[#697c6c]">Lý do: {yc.lyDo}</p>
                    {yc.trangThai === "DaTuChoi" && yc.lyDoTuChoi && (
                      <p className="mt-2 text-sm text-red-700">Lý do từ chối: {yc.lyDoTuChoi}</p>
                    )}
                    <p className="mt-3 text-xs text-[#89988c]">Gửi lúc: {yc.thoiGianGui}</p>
                  </article>
                ))}
                {duLieu.yeuCauCuaToi.length === 0 && <p className="rounded-lg bg-[#f3f6f2] p-5 text-sm text-[#829283]">Chưa có yêu cầu đổi ca nào.</p>}
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
