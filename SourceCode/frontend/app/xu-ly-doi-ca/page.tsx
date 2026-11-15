"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { keycloak, khoiTaoKeycloak } from "../../lib/keycloak";
import { layAccessToken } from "../../lib/auth-api";

const API = "http://localhost:3001";

type YeuCau = {
  maYeuCau: string;
  maNhanSuGui: string;
  tenNguoiGui: string;
  maPhanCongGoc: string;
  maNhanSuDangGiuCaGoc: string;
  viTriGoc: string;
  maCaGoc: string;
  maCaDeXuat: string;
  lyDo: string;
  lyDoTuChoi: string | null;
  trangThai: string;
  thoiGianGui: string;
  thoiGianXuLy: string | null;
  nguoiXuLy: string | null;
  ngayCaGoc: string;
  gioBatDauGoc: string;
  gioKetThucGoc: string;
  trangThaiCaGoc: string;
  ngayCaDeXuat: string;
  gioBatDauDeXuat: string;
  gioKetThucDeXuat: string;
  trangThaiCaDeXuat: string;
};

type PhanCongDich = {
  maPhanCong: string;
  maCa: string;
  maNhanSu: string;
  hoTen: string;
  loaiNhanSu: string;
  viTri: string;
};

type DuLieuQuanLy = {
  yeuCau: YeuCau[];
  nhanSuCaDeXuat: PhanCongDich[];
};

function ngayVN(iso: string) {
  const [nam, thang, ngay] = iso.slice(0, 10).split("-");
  return `${ngay}/${thang}/${nam}`;
}

function tenCa(gioBatDau: string) {
  return gioBatDau.slice(0, 5) < "14:00" ? "Ca sáng" : "Ca chiều";
}

function trangThaiVN(value: string) {
  const bang: Record<string, string> = {
    ChoXetDuyet: "Chờ xét duyệt",
    DaChapThuan: "Đã chấp thuận",
    DaTuChoi: "Đã từ chối",
  };
  return bang[value] ?? value;
}

function docLoiApi(data: unknown, status: number) {
  if (typeof data === "object" && data !== null && "message" in data) {
    const message = (data as { message?: string | string[] }).message;
    if (Array.isArray(message)) return message.join("; ");
    if (typeof message === "string") return message;
  }
  return `Yêu cầu thất bại (HTTP ${status}).`;
}

export default function XuLyDoiCaPage() {
  const [daKiemTra, setDaKiemTra] = useState(false);
  const [daDangNhap, setDaDangNhap] = useState(false);
  const [laQuanLy, setLaQuanLy] = useState(false);
  const [dangTai, setDangTai] = useState(false);
  const [dangXuLy, setDangXuLy] = useState(false);
  const [duLieu, setDuLieu] = useState<DuLieuQuanLy>({ yeuCau: [], nhanSuCaDeXuat: [] });
  const [maChon, setMaChon] = useState("");
  const [maPhanCongDoi, setMaPhanCongDoi] = useState("");
  const [lyDoTuChoi, setLyDoTuChoi] = useState("");
  const [boLoc, setBoLoc] = useState<"cho" | "tat-ca">("cho");
  const [loi, setLoi] = useState("");
  const [thongBao, setThongBao] = useState("");

  async function napDuLieu(chonMoi = false) {
    const token = await layAccessToken();
    const response = await fetch(`${API}/yeu-cau-doi-ca/quan-ly`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const body: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(docLoiApi(body, response.status));
    const data = body as DuLieuQuanLy;
    setDuLieu(data);
    if (chonMoi) {
      setMaChon(data.yeuCau.find((yc) => yc.trangThai === "ChoXetDuyet")?.maYeuCau ?? data.yeuCau[0]?.maYeuCau ?? "");
    }
    return data;
  }

  useEffect(() => {
    let hoatDong = true;
    async function khoiTao() {
      try {
        const authenticated = await khoiTaoKeycloak();
        if (!hoatDong) return;
        setDaDangNhap(authenticated);
        const roleQuanLy = authenticated && keycloak.hasRealmRole("QuanLy");
        setLaQuanLy(roleQuanLy);
        setDaKiemTra(true);
        if (!roleQuanLy) return;
        setDangTai(true);
        const token = await layAccessToken();
        const response = await fetch(`${API}/yeu-cau-doi-ca/quan-ly`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const body: unknown = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(docLoiApi(body, response.status));
        if (!hoatDong) return;
        const data = body as DuLieuQuanLy;
        setDuLieu(data);
        setMaChon(data.yeuCau.find((yc) => yc.trangThai === "ChoXetDuyet")?.maYeuCau ?? data.yeuCau[0]?.maYeuCau ?? "");
      } catch (error) {
        if (hoatDong) setLoi(error instanceof Error ? error.message : "Không tải được danh sách yêu cầu.");
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

  const danhSachHienThi = useMemo(
    () => duLieu.yeuCau.filter((yc) => boLoc === "tat-ca" || yc.trangThai === "ChoXetDuyet"),
    [duLieu.yeuCau, boLoc],
  );
  const ycChon = duLieu.yeuCau.find((yc) => yc.maYeuCau === maChon);
  const dsDoi = duLieu.nhanSuCaDeXuat.filter((pc) => pc.maCa === ycChon?.maCaDeXuat);
  const soChoDuyet = duLieu.yeuCau.filter((yc) => yc.trangThai === "ChoXetDuyet").length;

  function chonYeuCau(id: string) {
    setMaChon(id);
    setMaPhanCongDoi("");
    setLyDoTuChoi("");
    setLoi("");
    setThongBao("");
  }

  async function dangNhap() {
    await khoiTaoKeycloak();
    await keycloak.login({ redirectUri: `${window.location.origin}/xu-ly-doi-ca` });
  }

  async function xuLy(ketQua: "DaChapThuan" | "DaTuChoi") {
    if (!ycChon || ycChon.trangThai !== "ChoXetDuyet") return;
    setLoi("");
    setThongBao("");
    if (ketQua === "DaChapThuan" && !maPhanCongDoi) {
      setLoi("Chọn một nhân viên ở ca đề xuất để đổi tương ứng.");
      return;
    }
    if (ketQua === "DaTuChoi" && lyDoTuChoi.trim().length < 5) {
      setLoi("Lý do từ chối phải có ít nhất 5 ký tự.");
      return;
    }

    const thongBaoXacNhan = ketQua === "DaChapThuan"
      ? "Chấp thuận sẽ hoán đổi hai nhân viên giữa hai ca và cập nhật lịch ngay. Bạn xác nhận?"
      : "Bạn xác nhận từ chối yêu cầu này?";
    if (!window.confirm(thongBaoXacNhan)) return;

    setDangXuLy(true);
    try {
      const token = await layAccessToken();
      const response = await fetch(`${API}/yeu-cau-doi-ca/quan-ly/xu-ly`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maYeuCau: ycChon.maYeuCau,
          ketQua,
          ...(ketQua === "DaChapThuan" ? { maPhanCongDoi } : { lyDoTuChoi: lyDoTuChoi.trim() }),
        }),
      });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(docLoiApi(body, response.status));
      setThongBao(
        typeof body === "object" && body !== null && "thongBao" in body
          ? String((body as { thongBao: unknown }).thongBao)
          : "Đã xử lý yêu cầu đổi ca.",
      );
      setMaPhanCongDoi("");
      setLyDoTuChoi("");
    } catch (error) {
      setLoi(error instanceof Error ? error.message : "Không thể xử lý yêu cầu.");
      setDangXuLy(false);
      return;
    }

    try {
      await napDuLieu(true);
    } catch {
      setThongBao("Đã lưu kết quả xét duyệt, nhưng chưa tải lại được dữ liệu. Hãy làm mới trang.");
    } finally {
      setDangXuLy(false);
    }
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#849386]">Điều phối vận hành</p>
          <h1 className="text-3xl font-semibold text-[#30483a]">Xét duyệt yêu cầu đổi ca</h1>
          <p className="mt-2 text-sm text-[#748477]">Quản lý xem xét phương án đổi ca và phản hồi nhân viên.</p>
        </div>
        <Link href="/lich-lam-viec" className="rounded-lg border border-[#d6e0d5] bg-white px-4 py-2.5 text-sm text-[#30483a]">Xem lịch làm việc</Link>
      </div>

      {!daKiemTra ? (
        <section className="rounded-xl bg-white p-7 text-sm text-[#738576]">Đang kiểm tra đăng nhập...</section>
      ) : !daDangNhap ? (
        <section className="rounded-xl border border-[#e2e9e0] bg-white p-8 text-center">
          <p className="mb-4 text-sm text-[#748477]">Vui lòng đăng nhập để xét duyệt yêu cầu.</p>
          <button type="button" onClick={dangNhap} className="rounded-lg bg-[#30483a] px-5 py-3 text-sm font-semibold text-white">Đăng nhập</button>
        </section>
      ) : !laQuanLy ? (
        <section className="rounded-xl border border-[#e2e9e0] bg-white p-8 text-sm text-[#748477]">
          Chỉ tài khoản Quản lý mới được xét duyệt. <Link className="text-[#30483a] underline" href="/yeu-cau-doi-ca">Quay lại yêu cầu đổi ca</Link>.
        </section>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Tổng yêu cầu", value: duLieu.yeuCau.length },
              { label: "Chờ xét duyệt", value: soChoDuyet },
              { label: "Đã xử lý", value: duLieu.yeuCau.length - soChoDuyet },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-[#e2e9e0] bg-white p-5">
                <p className="text-xs text-[#839185]">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold text-[#30483a]">{dangTai ? "—" : item.value}</p>
              </div>
            ))}
          </div>

          {loi && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loi}</p>}
          {thongBao && <p role="status" className="rounded-lg border border-[#d5e4d2] bg-[#f2f7ef] p-4 text-sm text-[#365d3c]">{thongBao}</p>}

          {dangTai ? (
            <div className="rounded-xl bg-white p-8 text-sm text-[#748477]">Đang tải yêu cầu...</div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <section className="overflow-hidden rounded-xl border border-[#e2e9e0] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1eb] p-5">
                  <h2 className="font-semibold text-[#30483a]">Danh sách yêu cầu</h2>
                  <select aria-label="Lọc yêu cầu" value={boLoc} onChange={(e) => setBoLoc(e.target.value as "cho" | "tat-ca")} className="rounded-lg border border-[#dbe4da] bg-white p-2 text-sm text-[#30483a]">
                    <option value="cho">Đang chờ</option>
                    <option value="tat-ca">Tất cả</option>
                  </select>
                </div>
                <div className="max-h-[650px] space-y-2 overflow-y-auto p-3">
                  {danhSachHienThi.map((yc) => (
                    <button key={yc.maYeuCau} type="button" onClick={() => chonYeuCau(yc.maYeuCau)} className={`w-full rounded-lg border p-4 text-left transition-colors ${maChon === yc.maYeuCau ? "border-[#7c9a7f] bg-[#eff5ec]" : "border-[#edf1eb] hover:bg-[#f7f9f5]"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-[#30483a]">{yc.tenNguoiGui}</p>
                        <span className="rounded-md bg-white px-2 py-1 text-xs text-[#57735b]">{trangThaiVN(yc.trangThai)}</span>
                      </div>
                      <p className="mt-2 text-xs text-[#607563]">{yc.maCaGoc} → {yc.maCaDeXuat}</p>
                      <p className="mt-1 text-xs text-[#879588]">{yc.thoiGianGui} · {yc.maYeuCau}</p>
                    </button>
                  ))}
                  {danhSachHienThi.length === 0 && (
                    <p className="p-6 text-center text-sm text-[#849087]">Không có yêu cầu trong bộ lọc này.</p>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-[#e2e9e0] bg-white p-5 md:p-6">
                {!ycChon ? (
                  <p className="text-sm text-[#849087]">Chọn một yêu cầu để xem chi tiết.</p>
                ) : (
                  <>
                    <div className="border-b border-[#edf1eb] pb-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#829485]">Chi tiết yêu cầu</p>
                      <h2 className="mt-2 text-xl font-semibold text-[#30483a]">{ycChon.tenNguoiGui} · {ycChon.maNhanSuGui}</h2>
                      <p className="mt-1 text-xs text-[#879588]">Mã yêu cầu: {ycChon.maYeuCau}</p>
                    </div>
                    <div className="mt-5 space-y-3 text-sm text-[#526655]">
                      <p><span className="font-semibold text-[#30483a]">Ca gốc:</span> {ycChon.maCaGoc} · {ngayVN(ycChon.ngayCaGoc)} · {tenCa(ycChon.gioBatDauGoc)} · {ycChon.gioBatDauGoc.slice(0, 5)}–{ycChon.gioKetThucGoc.slice(0, 5)}</p>
                      <p><span className="font-semibold text-[#30483a]">Vị trí:</span> {ycChon.viTriGoc}</p>
                      <p><span className="font-semibold text-[#30483a]">Ca đề xuất:</span> {ycChon.maCaDeXuat} · {ngayVN(ycChon.ngayCaDeXuat)} · {tenCa(ycChon.gioBatDauDeXuat)} · {ycChon.gioBatDauDeXuat.slice(0, 5)}–{ycChon.gioKetThucDeXuat.slice(0, 5)}</p>
                      <p className="rounded-lg bg-[#f2f6f0] p-4"><span className="font-semibold">Lý do đề xuất:</span> {ycChon.lyDo}</p>
                    </div>

                    {ycChon.trangThai === "ChoXetDuyet" ? (
                      <div className="mt-6 space-y-5">
                        <div>
                          <label htmlFor="nguoi-doi" className="mb-2 block text-sm font-semibold text-[#30483a]">Người ở ca đề xuất sẽ đổi tương ứng</label>
                          <select id="nguoi-doi" value={maPhanCongDoi} disabled={dangXuLy} onChange={(e) => setMaPhanCongDoi(e.target.value)} className="w-full rounded-lg border border-[#dce5da] bg-white px-3 py-3 text-sm text-[#30483a]">
                            <option value="">-- Chọn nhân viên ca đề xuất --</option>
                            {dsDoi.map((pc) => (
                              <option key={pc.maPhanCong} value={pc.maPhanCong}>
                                {pc.viTri} · {pc.hoTen} ({pc.maNhanSu})
                              </option>
                            ))}
                          </select>
                          <p className="mt-2 text-xs leading-5 text-[#819083]">Chấp thuận sẽ hoán đổi người gửi với nhân viên được chọn. Backend kiểm tra lại hai ca có đủ 4 vị trí, Trưởng ca hợp lệ và không trùng lịch.</p>
                          {dsDoi.length !== 4 && <p className="mt-2 text-xs text-amber-700">Ca đề xuất chưa đủ 4 người, hiện không thể chấp thuận phương án hoán đổi.</p>}
                        </div>
                        <button type="button" onClick={() => void xuLy("DaChapThuan")} disabled={dangXuLy || !maPhanCongDoi || dsDoi.length !== 4} className="w-full rounded-lg bg-[#30483a] px-5 py-3 text-sm font-semibold text-white hover:bg-[#476650] disabled:cursor-not-allowed disabled:opacity-45">
                          {dangXuLy ? "Đang xử lý..." : "Chấp thuận và cập nhật hai ca"}
                        </button>
                        <div className="border-t border-[#edf1eb] pt-5">
                          <label htmlFor="ly-do-tu-choi" className="mb-2 block text-sm font-semibold text-[#30483a]">Lý do từ chối</label>
                          <textarea id="ly-do-tu-choi" value={lyDoTuChoi} disabled={dangXuLy} onChange={(e) => setLyDoTuChoi(e.target.value)} maxLength={500} rows={3} placeholder="Giải thích vì sao không thể chấp thuận..." className="w-full resize-y rounded-lg border border-[#dce5da] bg-white px-3 py-3 text-sm text-[#30483a]" />
                          <button type="button" onClick={() => void xuLy("DaTuChoi")} disabled={dangXuLy || lyDoTuChoi.trim().length < 5} className="mt-3 rounded-lg border border-red-300 px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45">Từ chối yêu cầu</button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-6 rounded-lg bg-[#f2f6f0] p-4 text-sm text-[#526655]">
                        <p className="font-semibold">{trangThaiVN(ycChon.trangThai)}</p>
                        <p className="mt-2">Người xử lý: {ycChon.nguoiXuLy ?? "Chưa rõ"}</p>
                        <p className="mt-1">Thời gian xử lý: {ycChon.thoiGianXuLy ?? "—"}</p>
                        {ycChon.lyDoTuChoi && <p className="mt-2 text-red-700">Lý do từ chối: {ycChon.lyDoTuChoi}</p>}
                      </div>
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
