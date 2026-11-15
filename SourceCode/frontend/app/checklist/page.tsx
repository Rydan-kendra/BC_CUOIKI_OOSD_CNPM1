"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { keycloak, khoiTaoKeycloak } from "../../lib/keycloak";
import { layAccessToken } from "../../lib/auth-api";

const API = "http://localhost:3001";

type CaCuaToi = {
  maPhanCong: string;
  maCa: string;
  viTri: string;
  ngayLam: string;
  gioBatDau: string;
  gioKetThuc: string;
  trangThai: string;
  coTheThucHien: number;
};

type DanhSach = {
  maDanhSach: string;
  viTri: string;
  tenDanhSach: string;
};

type NoiDung = {
  maNoiDung: string;
  maDanhSach: string;
  noiDung: string;
  thuTu: number;
};

type LichSu = {
  maLan: string;
  maPhanCong: string;
  maDanhSach: string;
  tenDanhSach: string;
  maCa: string;
  viTri: string;
  ngayLam: string;
  thoiGianHoanTat: string;
  trangThai: string;
  soDat: number;
  soKhongDat: number;
};

type DuLieu = {
  caCuaToi: CaCuaToi[];
  danhSach: DanhSach[];
  noiDung: NoiDung[];
  lichSu: LichSu[];
};

type CauTraLoi = { ketQua: "Dat" | "KhongDat" | ""; ghiChu: string };

function ngayVN(value: string) {
  const [nam, thang, ngay] = value.slice(0, 10).split("-");
  return `${ngay}/${thang}/${nam}`;
}

function docLoi(data: unknown, status: number) {
  if (typeof data === "object" && data !== null && "message" in data) {
    const message = (data as { message?: string | string[] }).message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join("; ");
  }
  return `Không thể xử lý yêu cầu (HTTP ${status}).`;
}

export default function ChecklistPage() {
  const [daKiemTra, setDaKiemTra] = useState(false);
  const [daDangNhap, setDaDangNhap] = useState(false);
  const [laNhanVien, setLaNhanVien] = useState(false);
  const [dangTai, setDangTai] = useState(true);
  const [dangLuu, setDangLuu] = useState(false);
  const [duLieu, setDuLieu] = useState<DuLieu>({ caCuaToi: [], danhSach: [], noiDung: [], lichSu: [] });
  const [maPhanCong, setMaPhanCong] = useState("");
  const [maDanhSach, setMaDanhSach] = useState("");
  const [cauTraLoi, setCauTraLoi] = useState<Record<string, CauTraLoi>>({});
  const [loi, setLoi] = useState("");
  const [thongBao, setThongBao] = useState("");

  useEffect(() => {
    let hoatDong = true;
    async function khoiTao() {
      try {
        const authenticated = await khoiTaoKeycloak();
        if (!hoatDong) return;
        setDaDangNhap(authenticated);
        const roleNhanVien = authenticated && keycloak.hasRealmRole("NhanVien") && !keycloak.hasRealmRole("QuanLy");
        setLaNhanVien(roleNhanVien);
        if (!roleNhanVien) return;

        const token = await layAccessToken();
        const response = await fetch(`${API}/checklist/du-lieu`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const body: unknown = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(docLoi(body, response.status));
        if (!hoatDong) return;
        const data = body as DuLieu;
        setDuLieu(data);
        const ca = data.caCuaToi.find((item) => Number(item.coTheThucHien) === 1) ?? data.caCuaToi[0];
        setMaPhanCong(ca?.maPhanCong ?? "");
        setMaDanhSach(data.danhSach.find((ds) => ds.viTri === ca?.viTri)?.maDanhSach ?? "");
      } catch (error) {
        if (hoatDong) setLoi(error instanceof Error ? error.message : "Không tải được checklist.");
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

  const caChon = duLieu.caCuaToi.find((ca) => ca.maPhanCong === maPhanCong);
  const dsPhuHop = duLieu.danhSach.filter((ds) => ds.viTri === caChon?.viTri);
  const dsChon = dsPhuHop.find((ds) => ds.maDanhSach === maDanhSach);
  const cacMuc = useMemo(
    () => duLieu.noiDung.filter((item) => item.maDanhSach === dsChon?.maDanhSach),
    [duLieu.noiDung, dsChon?.maDanhSach],
  );
  const daTraLoi = cacMuc.filter((item) => cauTraLoi[item.maNoiDung]?.ketQua).length;
  const tatCaHopLe = cacMuc.length > 0 && cacMuc.every((item) => {
    const traLoi = cauTraLoi[item.maNoiDung];
    if (!traLoi || !traLoi.ketQua) return false;
    return traLoi.ketQua !== "KhongDat" || traLoi.ghiChu.trim().length >= 3;
  });

  function chonCa(value: string) {
    setMaPhanCong(value);
    const ca = duLieu.caCuaToi.find((item) => item.maPhanCong === value);
    setMaDanhSach(duLieu.danhSach.find((ds) => ds.viTri === ca?.viTri)?.maDanhSach ?? "");
    setCauTraLoi({});
    setLoi("");
    setThongBao("");
  }

  function chonDanhSach(value: string) {
    setMaDanhSach(value);
    setCauTraLoi({});
    setLoi("");
    setThongBao("");
  }

  function capNhatTraLoi(maNoiDung: string, thayDoi: Partial<CauTraLoi>) {
    setCauTraLoi((prev) => ({
      ...prev,
      [maNoiDung]: { ketQua: "", ghiChu: "", ...prev[maNoiDung], ...thayDoi },
    }));
  }

  async function dangNhap() {
    try {
      await khoiTaoKeycloak();
      await keycloak.login({ redirectUri: `${window.location.origin}/checklist` });
    } catch {
      setLoi("Không thể chuyển đến trang đăng nhập.");
    }
  }

  async function hoanTat() {
    if (!caChon || !dsChon || dangLuu) return;
    setLoi("");
    setThongBao("");
    if (Number(caChon.coTheThucHien) !== 1) {
      setLoi("Chỉ có thể hoàn tất checklist khi ca đang diễn ra.");
      return;
    }
    if (!tatCaHopLe) {
      setLoi("Hãy chọn Đạt/Không đạt cho tất cả mục và ghi chú cho những mục chưa đạt.");
      return;
    }
    if (!window.confirm("Xác nhận hoàn tất danh sách kiểm tra? Kết quả sẽ được lưu vào lịch sử và dùng khi bàn giao ca.")) return;

    setDangLuu(true);
    try {
      const token = await layAccessToken();
      const response = await fetch(`${API}/checklist/hoan-tat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maPhanCong: caChon.maPhanCong,
          maDanhSach: dsChon.maDanhSach,
          ketQua: cacMuc.map((item) => ({
            maNoiDung: item.maNoiDung,
            ketQua: cauTraLoi[item.maNoiDung].ketQua,
            ghiChu: cauTraLoi[item.maNoiDung].ghiChu.trim(),
          })),
        }),
      });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(docLoi(body, response.status));
      setThongBao("Đã hoàn tất checklist và lưu toàn bộ kết quả.");
      setCauTraLoi({});

      try {
        const reload = await fetch(`${API}/checklist/du-lieu`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data: unknown = await reload.json().catch(() => ({}));
        if (!reload.ok) throw new Error(docLoi(data, reload.status));
        setDuLieu(data as DuLieu);
      } catch {
        setThongBao("Đã lưu checklist, nhưng chưa tải lại được lịch sử. Hãy làm mới trang.");
      }
    } catch (error) {
      setLoi(error instanceof Error ? error.message : "Không lưu được checklist.");
    } finally {
      setDangLuu(false);
    }
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#849386]">Vận hành theo vị trí</p>
          <h1 className="text-3xl font-semibold text-[#30483a]">Danh sách kiểm tra</h1>
          <p className="mt-2 text-sm text-[#748477]">Ghi nhận các công việc cần kiểm tra để chuẩn bị bàn giao ca.</p>
        </div>
        <Link href="/lich-lam-viec" className="rounded-lg border border-[#d6e0d5] bg-white px-4 py-2.5 text-sm text-[#30483a]">Xem lịch làm việc</Link>
      </div>

      {loi && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loi}</p>}
      {thongBao && <p role="status" className="rounded-lg border border-[#d5e4d2] bg-[#f2f7ef] p-4 text-sm text-[#365d3c]">{thongBao}</p>}

      {!daKiemTra || dangTai ? (
        <section className="rounded-xl border border-[#e2e9e0] bg-white p-7 text-sm text-[#748477]">Đang tải thông tin kiểm tra...</section>
      ) : !daDangNhap ? (
        <section className="rounded-xl border border-[#e2e9e0] bg-white p-7">
          <p className="mb-4 text-sm text-[#748477]">Bạn cần đăng nhập để thực hiện checklist.</p>
          <button type="button" onClick={() => void dangNhap()} className="rounded-lg bg-[#30483a] px-5 py-3 text-sm font-semibold text-white">Đăng nhập</button>
        </section>
      ) : !laNhanVien ? (
        <section className="rounded-xl border border-[#e2e9e0] bg-white p-7 text-sm text-[#748477]">Chức năng này dành cho nhân viên ở vị trí Pha chế, Thu ngân hoặc Khu vực phục vụ.</section>
      ) : duLieu.caCuaToi.length === 0 ? (
        <section className="rounded-xl border border-[#e2e9e0] bg-white p-7 text-sm text-[#748477]">Bạn chưa được phân công vào vị trí Pha chế, Thu ngân hoặc Khu vực phục vụ trong khoảng thời gian hiển thị.</section>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)]">
            <section className="self-start rounded-xl border border-[#e2e9e0] bg-white p-5 md:p-6">
              <h2 className="text-lg font-semibold text-[#30483a]">Thông tin ca làm việc</h2>
              <label htmlFor="ca-can-kiem-tra" className="mt-5 mb-2 block text-sm font-medium text-[#445949]">Ca của tôi</label>
              <select id="ca-can-kiem-tra" value={maPhanCong} onChange={(event) => chonCa(event.target.value)} className="w-full rounded-lg border border-[#dce5da] bg-white px-3 py-3 text-sm text-[#30483a]">
                {duLieu.caCuaToi.map((ca) => (
                  <option key={ca.maPhanCong} value={ca.maPhanCong}>
                    {ca.maCa} · {ngayVN(ca.ngayLam)} · {ca.gioBatDau.slice(0, 5)}–{ca.gioKetThuc.slice(0, 5)} · {ca.viTri}
                  </option>
                ))}
              </select>
              {caChon && (
                <div className="mt-4 space-y-2 rounded-lg bg-[#f4f7f2] p-4 text-sm text-[#526655]">
                  <p><span className="font-semibold text-[#30483a]">Vị trí:</span> {caChon.viTri}</p>
                  <p><span className="font-semibold text-[#30483a]">Ngày:</span> {ngayVN(caChon.ngayLam)}</p>
                  <p><span className="font-semibold text-[#30483a]">Giờ:</span> {caChon.gioBatDau.slice(0, 5)}–{caChon.gioKetThuc.slice(0, 5)}</p>
                  <p className={`font-medium ${Number(caChon.coTheThucHien) === 1 ? "text-[#45764b]" : "text-amber-700"}`}>
                    {Number(caChon.coTheThucHien) === 1 ? "Có thể hoàn tất checklist" : "Chưa đến giờ hoặc ca đã kết thúc"}
                  </p>
                </div>
              )}
              <label htmlFor="danh-sach-kiem-tra" className="mt-5 mb-2 block text-sm font-medium text-[#445949]">Danh sách theo vị trí</label>
              <select id="danh-sach-kiem-tra" value={dsChon?.maDanhSach ?? ""} onChange={(event) => chonDanhSach(event.target.value)} className="w-full rounded-lg border border-[#dce5da] bg-white px-3 py-3 text-sm text-[#30483a]">
                {dsPhuHop.length === 0 && <option value="">Chưa có danh sách phù hợp</option>}
                {dsPhuHop.map((ds) => <option key={ds.maDanhSach} value={ds.maDanhSach}>{ds.tenDanhSach}</option>)}
              </select>
            </section>

            <section className="overflow-hidden rounded-xl border border-[#e2e9e0] bg-white">
              <div className="border-b border-[#e9eee7] bg-[#edf3e9] px-5 py-4 md:px-6">
                <h2 className="font-semibold text-[#30483a]">{dsChon?.tenDanhSach ?? "Các mục kiểm tra"}</h2>
                <p className="mt-1 text-xs text-[#657967]">Đã ghi nhận {daTraLoi}/{cacMuc.length} mục</p>
              </div>
              {cacMuc.length === 0 ? (
                <p className="p-6 text-sm text-[#748477]">Chưa có nội dung kiểm tra cho vị trí này. Cần bổ sung dữ liệu trong SQL Server.</p>
              ) : (
                <div className="divide-y divide-[#edf1eb]">
                  {cacMuc.map((muc, index) => {
                    const giaTri = cauTraLoi[muc.maNoiDung] ?? { ketQua: "", ghiChu: "" };
                    return (
                      <div key={muc.maNoiDung} className="space-y-3 px-5 py-5 md:px-6">
                        <div className="flex items-start gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#edf3e9] text-xs font-semibold text-[#4b664d]">{index + 1}</span>
                          <p className="flex-1 text-sm font-medium leading-6 text-[#30483a]">{muc.noiDung}</p>
                        </div>
                        <div className="flex gap-3 pl-10">
                          <button type="button" aria-pressed={giaTri.ketQua === "Dat"} onClick={() => capNhatTraLoi(muc.maNoiDung, { ketQua: "Dat" })} className={`rounded-lg border px-4 py-2 text-sm font-medium ${giaTri.ketQua === "Dat" ? "border-[#7b9c7c] bg-[#e9f4e8] text-[#38613b]" : "border-[#dae3d9] text-[#697d6b] hover:bg-[#f6f9f4]"}`}>Đạt</button>
                          <button type="button" aria-pressed={giaTri.ketQua === "KhongDat"} onClick={() => capNhatTraLoi(muc.maNoiDung, { ketQua: "KhongDat" })} className={`rounded-lg border px-4 py-2 text-sm font-medium ${giaTri.ketQua === "KhongDat" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-[#dae3d9] text-[#697d6b] hover:bg-[#f6f9f4]"}`}>Không đạt</button>
                        </div>
                        <textarea aria-label={`Ghi chú mục ${index + 1}`} value={giaTri.ghiChu} onChange={(event) => capNhatTraLoi(muc.maNoiDung, { ghiChu: event.target.value })} maxLength={500} rows={2} placeholder={giaTri.ketQua === "KhongDat" ? "Ghi rõ thiếu sót (bắt buộc)..." : "Ghi chú nếu có..."} className="ml-10 w-[calc(100%-2.5rem)] resize-y rounded-lg border border-[#dae3d9] bg-white px-3 py-2.5 text-sm text-[#30483a] placeholder:text-[#a0aea1]" />
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="border-t border-[#e9eee7] bg-[#fafbf9] p-5 md:p-6">
                <button type="button" onClick={() => void hoanTat()} disabled={!tatCaHopLe || dangLuu || Number(caChon?.coTheThucHien) !== 1} className="w-full rounded-lg bg-[#30483a] px-5 py-3 text-sm font-semibold text-white hover:bg-[#45664d] disabled:cursor-not-allowed disabled:opacity-45">
                  {dangLuu ? "Đang lưu kết quả..." : "Hoàn tất kiểm tra"}
                </button>
                <p className="mt-2 text-xs text-[#879588]">Mục Không đạt phải có ghi chú ít nhất 3 ký tự. Sau khi hoàn tất, kết quả sẽ được lưu vào lịch sử để phục vụ bàn giao.</p>
              </div>
            </section>
          </div>

          <section className="overflow-hidden rounded-xl border border-[#e2e9e0] bg-white">
            <div className="border-b border-[#e9eee7] p-5 md:px-6">
              <h2 className="text-lg font-semibold text-[#30483a]">Lịch sử kiểm tra của tôi</h2>
              <p className="mt-1 text-xs text-[#859287]">Các lần kiểm tra đã lưu, mới nhất ở trên</p>
            </div>
            {duLieu.lichSu.length === 0 ? (
              <p className="p-6 text-sm text-[#748477]">Chưa có lần kiểm tra nào được hoàn tất.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="bg-[#edf3e9] text-xs text-[#4c644f]"><tr><th className="px-5 py-3">Ca / Ngày</th><th className="px-5 py-3">Danh sách</th><th className="px-5 py-3">Kết quả</th><th className="px-5 py-3">Thời gian hoàn tất</th></tr></thead>
                  <tbody className="divide-y divide-[#edf1eb]">
                    {duLieu.lichSu.map((lan) => (
                      <tr key={lan.maLan}>
                        <td className="px-5 py-3 text-[#30483a]">{lan.maCa} · {ngayVN(lan.ngayLam)}</td>
                        <td className="px-5 py-3 text-[#526655]">{lan.tenDanhSach}</td>
                        <td className="px-5 py-3 text-[#526655]">{lan.soDat} đạt · {lan.soKhongDat} không đạt</td>
                        <td className="px-5 py-3 text-[#728175]">{lan.thoiGianHoanTat?.replace(" ", " · ") ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
