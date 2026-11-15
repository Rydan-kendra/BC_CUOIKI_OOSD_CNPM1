"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { keycloak, khoiTaoKeycloak } from "../../lib/keycloak";
import { layAccessToken } from "../../lib/auth-api";

const API = "http://localhost:3001";

type CaNhan = {
  maPhanCongNhan: string;
  maCaNhan: string;
  maNhanSuNhan: string;
  viTri: string;
  ngayNhan: string;
  gioBatDauNhan: string;
  gioKetThucNhan: string;
  trangThaiCaNhan: string;
  coTheTiepNhan: number;
  maCaGiao: string | null;
  ngayGiao: string | null;
  gioBatDauGiao: string | null;
  gioKetThucGiao: string | null;
  maPhanCongGiao: string | null;
  maNhanSuGiao: string | null;
  tenNguoiGiao: string | null;
  maLanKiemTra: string | null;
  tenDanhSach: string | null;
  thoiGianHoanTat: string | null;
  maBanGiao: string | null;
  trangThaiTiepNhan: string | null;
  ghiChuTiepNhan: string | null;
  thoiGianTiepNhan: string | null;
  soDat: number;
  soKhongDat: number;
};

type MucKiemTra = {
  maLan: string;
  maNoiDung: string;
  noiDung: string;
  thuTu: number;
  ketQua: "Dat" | "KhongDat";
  ghiChu: string | null;
};

type DuLieu = { caCuaToi: CaNhan[]; ketQuaKiemTra: MucKiemTra[] };
type TrangThai = "DaTiepNhan" | "CanBoSung";

function ngayVN(value: string | null) {
  if (!value) return "—";
  const [nam, thang, ngay] = value.slice(0, 10).split("-");
  return `${ngay}/${thang}/${nam}`;
}

function docLoi(value: unknown, status: number) {
  if (typeof value === "object" && value !== null && "message" in value) {
    const message = (value as { message?: string | string[] }).message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join("; ");
  }
  return `Có lỗi khi kết nối hệ thống (HTTP ${status}).`;
}

function moTaTrangThai(value: string | null) {
  if (value === "DaTiepNhan") return "Đã tiếp nhận";
  if (value === "CanBoSung") return "Cần bổ sung";
  return "Chưa xử lý";
}

export default function BanGiaoTheoViTriPage() {
  const [dangTai, setDangTai] = useState(true);
  const [daDangNhap, setDaDangNhap] = useState(false);
  const [laNhanVien, setLaNhanVien] = useState(false);
  const [dangLuu, setDangLuu] = useState(false);
  const [duLieu, setDuLieu] = useState<DuLieu>({ caCuaToi: [], ketQuaKiemTra: [] });
  const [maPhanCongNhan, setMaPhanCongNhan] = useState("");
  const [luaChon, setLuaChon] = useState<TrangThai>("DaTiepNhan");
  const [ghiChu, setGhiChu] = useState("");
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
        const response = await fetch(`${API}/ban-giao-vi-tri/du-lieu`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const body: unknown = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(docLoi(body, response.status));
        if (!hoatDong) return;
        const data = body as DuLieu;
        setDuLieu(data);
        const ca = data.caCuaToi.find((item) => Number(item.coTheTiepNhan) === 1 && item.maLanKiemTra && item.trangThaiTiepNhan !== "DaTiepNhan")
          ?? data.caCuaToi.find((item) => item.maLanKiemTra && item.trangThaiTiepNhan !== "DaTiepNhan")
          ?? data.caCuaToi[0];
        setMaPhanCongNhan(ca?.maPhanCongNhan ?? "");
      } catch (error) {
        if (hoatDong) setLoi(error instanceof Error ? error.message : "Không tải được dữ liệu bàn giao.");
      } finally {
        if (hoatDong) setDangTai(false);
      }
    }

    void khoiTao();
    return () => { hoatDong = false; };
  }, []);

  const caChon = duLieu.caCuaToi.find((ca) => ca.maPhanCongNhan === maPhanCongNhan);
  const ketQua = useMemo(
    () => duLieu.ketQuaKiemTra.filter((muc) => muc.maLan === caChon?.maLanKiemTra),
    [duLieu.ketQuaKiemTra, caChon?.maLanKiemTra],
  );
  const coDuLieuBanGiao = Boolean(caChon?.maPhanCongGiao && caChon.maLanKiemTra);
  const daTiepNhan = caChon?.trangThaiTiepNhan === "DaTiepNhan";
  const laNguoiCu = Boolean(caChon?.maNhanSuNhan && caChon.maNhanSuNhan === caChon.maNhanSuGiao);
  const canGhiChu = luaChon === "CanBoSung" || Number(caChon?.soKhongDat) > 0;
  const coTheLuu = Boolean(
    caChon && Number(caChon.coTheTiepNhan) === 1 && coDuLieuBanGiao &&
    !daTiepNhan && !laNguoiCu && !dangLuu && (!canGhiChu || ghiChu.trim().length >= 5),
  );

  function chonCa(value: string) {
    setMaPhanCongNhan(value);
    setGhiChu("");
    setLuaChon("DaTiepNhan");
    setLoi("");
    setThongBao("");
  }

  async function dangNhap() {
    try {
      await khoiTaoKeycloak();
      await keycloak.login({ redirectUri: `${window.location.origin}/ban-giao-vi-tri` });
    } catch {
      setLoi("Không thể chuyển đến trang đăng nhập.");
    }
  }

  async function guiKetQua() {
    if (!caChon || !caChon.maLanKiemTra || !coTheLuu) return;
    const moTa = luaChon === "DaTiepNhan" ? "đồng ý tiếp nhận" : "ghi nhận cần bổ sung";
    if (!window.confirm(`Xác nhận ${moTa} vị trí ${caChon.viTri} từ ca ${caChon.maCaGiao}?`)) return;

    setLoi("");
    setThongBao("");
    setDangLuu(true);
    try {
      const token = await layAccessToken();
      const response = await fetch(`${API}/ban-giao-vi-tri/tiep-nhan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          maPhanCongNhan: caChon.maPhanCongNhan,
          maLanKiemTra: caChon.maLanKiemTra,
          trangThaiTiepNhan: luaChon,
          ghiChu: ghiChu.trim(),
        }),
      });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(docLoi(body, response.status));
      setThongBao(luaChon === "DaTiepNhan"
        ? "Đã xác nhận tiếp nhận vị trí và lưu thời gian tiếp nhận."
        : "Đã lưu nội dung thiếu sót, vị trí này vẫn chưa được xác nhận tiếp nhận.");
      setGhiChu("");
      setLuaChon("DaTiepNhan");

      try {
        const res = await fetch(`${API}/ban-giao-vi-tri/du-lieu`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data: unknown = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(docLoi(data, res.status));
        setDuLieu(data as DuLieu);
      } catch {
        setThongBao("Đã lưu kết quả, nhưng chưa cập nhật được thông tin trên màn hình. Hãy tải lại trang.");
      }
    } catch (error) {
      setLoi(error instanceof Error ? error.message : "Không thể lưu kết quả tiếp nhận.");
    } finally {
      setDangLuu(false);
    }
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#849386]">VẬN HÀNH THEO VỊ TRÍ</p>
          <h1 className="text-3xl font-semibold text-[#30483a]">Tiếp nhận bàn giao theo vị trí</h1>
          <p className="mt-2 text-sm text-[#748477]">Đối chiếu checklist mới nhất của ca trước với tình trạng thực tế tại vị trí của bạn.</p>
        </div>
        <Link href="/checklist" className="rounded-lg border border-[#d6e0d5] bg-white px-4 py-2.5 text-sm text-[#30483a] hover:bg-[#f8faf7]">Xem Checklist</Link>
      </div>

      {loi && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loi}</p>}
      {thongBao && <p role="status" className="rounded-lg border border-[#d5e4d2] bg-[#f2f7ef] p-4 text-sm text-[#365d3c]">{thongBao}</p>}

      {dangTai ? (
        <section className="rounded-xl border border-[#e2e9e0] bg-white p-7 text-sm text-[#748477]">Đang tải thông tin bàn giao...</section>
      ) : !daDangNhap ? (
        <section className="rounded-xl border border-[#e2e9e0] bg-white p-7">
          <p className="mb-4 text-sm text-[#748477]">Bạn cần đăng nhập để tiếp nhận bàn giao theo vị trí.</p>
          <button type="button" onClick={() => void dangNhap()} className="rounded-lg bg-[#30483a] px-5 py-3 text-sm font-semibold text-white">Đăng nhập</button>
        </section>
      ) : !laNhanVien ? (
        <section className="rounded-xl border border-[#e2e9e0] bg-white p-7 text-sm text-[#748477]">Chức năng này dành cho nhân viên được phân công Pha chế, Thu ngân hoặc Khu vực phục vụ. Trưởng ca có chức năng bàn giao ca riêng.</section>
      ) : duLieu.caCuaToi.length === 0 ? (
        <section className="rounded-xl border border-[#e2e9e0] bg-white p-7 text-sm text-[#748477]">Bạn chưa có phân công tại vị trí áp dụng trong khoảng thời gian hiển thị.</section>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
            <section className="self-start rounded-xl border border-[#e2e9e0] bg-white p-5 md:p-6">
              <h2 className="text-lg font-semibold text-[#30483a]">Ca tiếp nhận của tôi</h2>
              <label htmlFor="ca-tiep-nhan" className="mt-5 mb-2 block text-sm font-medium text-[#445949]">Chọn ca được phân công</label>
              <select id="ca-tiep-nhan" value={maPhanCongNhan} onChange={(event) => chonCa(event.target.value)} className="w-full rounded-lg border border-[#dce5da] bg-white px-3 py-3 text-sm text-[#30483a]">
                {duLieu.caCuaToi.map((ca) => (
                  <option key={ca.maPhanCongNhan} value={ca.maPhanCongNhan}>
                    {ca.maCaNhan} · {ngayVN(ca.ngayNhan)} · {ca.gioBatDauNhan.slice(0, 5)}–{ca.gioKetThucNhan.slice(0, 5)} · {ca.viTri}
                  </option>
                ))}
              </select>

              {caChon && (
                <div className="mt-4 space-y-2 rounded-lg bg-[#f4f7f2] p-4 text-sm text-[#526655]">
                  <p><span className="font-semibold text-[#30483a]">Vị trí:</span> {caChon.viTri}</p>
                  <p><span className="font-semibold text-[#30483a]">Ngày:</span> {ngayVN(caChon.ngayNhan)}</p>
                  <p><span className="font-semibold text-[#30483a]">Thời gian:</span> {caChon.gioBatDauNhan.slice(0, 5)}–{caChon.gioKetThucNhan.slice(0, 5)}</p>
                  <p><span className="font-semibold text-[#30483a]">Trạng thái:</span> {moTaTrangThai(caChon.trangThaiTiepNhan)}</p>
                  {caChon.thoiGianTiepNhan && <p><span className="font-semibold text-[#30483a]">Đã nhận lúc:</span> {caChon.thoiGianTiepNhan.replace(" ", " · ")}</p>}
                  {caChon.ghiChuTiepNhan && <p><span className="font-semibold text-[#30483a]">Ghi chú đã lưu:</span> {caChon.ghiChuTiepNhan}</p>}
                  <p className={`pt-2 font-medium ${Number(caChon.coTheTiepNhan) === 1 ? "text-[#45764b]" : "text-amber-700"}`}>
                    {Number(caChon.coTheTiepNhan) === 1 ? "Ca đang diễn ra, có thể tiếp nhận" : "Chưa đến giờ tiếp nhận hoặc ca đã kết thúc"}
                  </p>
                </div>
              )}

              <div className="mt-5 rounded-lg border border-[#dce5da] bg-white p-4 text-sm">
                <h3 className="font-semibold text-[#30483a]">Thông tin ca bàn giao</h3>
                {caChon?.maCaGiao ? (
                  <div className="mt-3 space-y-2 text-[#536955]">
                    <p><span className="font-medium">Ca trước:</span> {caChon.maCaGiao}</p>
                    <p><span className="font-medium">Ngày:</span> {ngayVN(caChon.ngayGiao)}</p>
                    <p><span className="font-medium">Giờ:</span> {caChon.gioBatDauGiao?.slice(0, 5)}–{caChon.gioKetThucGiao?.slice(0, 5)}</p>
                    <p><span className="font-medium">Người bàn giao:</span> {caChon.tenNguoiGiao ?? "Chưa phân công cùng vị trí"}</p>
                  </div>
                ) : <p className="mt-2 text-[#859287]">Không tìm thấy ca liền trước để bàn giao.</p>}
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-[#e2e9e0] bg-white">
              <div className="border-b border-[#e9eee7] bg-[#edf3e9] px-5 py-4 md:px-6">
                <h2 className="font-semibold text-[#30483a]">Checklist từ ca trước</h2>
                <p className="mt-1 text-xs text-[#657967]">{caChon?.tenDanhSach ?? "Chưa có checklist hoàn tất cho vị trí này"}</p>
              </div>

              {!coDuLieuBanGiao ? (
                <div className="p-6 text-sm text-[#748477]">
                  Ca trước chưa hoàn tất danh sách kiểm tra cho đúng vị trí, hoặc chưa có người được phân công tại vị trí này. Chưa thể thực hiện tiếp nhận.
                </div>
              ) : (
                <>
                  <div className="grid gap-3 border-b border-[#edf1eb] px-5 py-4 text-sm text-[#536955] sm:grid-cols-3 md:px-6">
                    <p><span className="font-semibold text-[#30483a]">Đạt:</span> {Number(caChon?.soDat ?? 0)}</p>
                    <p><span className="font-semibold text-[#30483a]">Không đạt:</span> {Number(caChon?.soKhongDat ?? 0)}</p>
                    <p><span className="font-semibold text-[#30483a]">Hoàn tất:</span> {caChon?.thoiGianHoanTat?.replace(" ", " · ") ?? "—"}</p>
                  </div>
                  <div className="divide-y divide-[#edf1eb]">
                    {ketQua.map((muc, index) => (
                      <div key={muc.maNoiDung} className="px-5 py-4 md:px-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <p className="max-w-[85%] text-sm font-medium leading-6 text-[#30483a]">{index + 1}. {muc.noiDung}</p>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${muc.ketQua === "Dat" ? "bg-[#e9f4e8] text-[#38613b]" : "bg-amber-50 text-amber-800"}`}>
                            {muc.ketQua === "Dat" ? "Đạt" : "Không đạt"}
                          </span>
                        </div>
                        {muc.ghiChu && <p className="mt-2 text-xs leading-5 text-[#778779]">Ghi chú ca trước: {muc.ghiChu}</p>}
                      </div>
                    ))}
                  </div>
                  {Number(caChon?.soKhongDat ?? 0) > 0 && (
                    <p className="mx-5 mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 md:mx-6">
                      Checklist ca trước có mục không đạt. Hãy đối chiếu thực tế và ghi rõ tình trạng hoặc cách xử lý trước khi xác nhận tiếp nhận.
                    </p>
                  )}
                </>
              )}
            </section>
          </div>

          {coDuLieuBanGiao && (
            <section className="rounded-xl border border-[#e2e9e0] bg-white p-5 md:p-6">
              <h2 className="text-lg font-semibold text-[#30483a]">Kết quả đối chiếu thực tế</h2>
              <p className="mt-2 text-sm text-[#748477]">Kiểm tra trực tiếp vị trí làm việc trước khi xác nhận. Nếu có thiếu sót, cần ghi rõ để theo dõi và xử lý.</p>

              {daTiepNhan ? (
                <div className="mt-5 rounded-lg bg-[#edf7e9] p-4 text-sm text-[#3b6341]">
                  Vị trí này đã được xác nhận tiếp nhận, hệ thống không cho phép xác nhận lại.
                </div>
              ) : (
                <>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <button type="button" aria-pressed={luaChon === "DaTiepNhan"} onClick={() => setLuaChon("DaTiepNhan")}
                      className={`rounded-lg border px-5 py-4 text-left text-sm transition-colors ${luaChon === "DaTiepNhan" ? "border-[#6b9270] bg-[#e9f4e8] text-[#315e36]" : "border-[#dae3d9] text-[#607563] hover:bg-[#f7faf5]"}`}>
                      <span className="block font-semibold">Đồng ý tiếp nhận</span>
                      <span className="mt-1 block text-xs">Tình trạng thực tế đã được kiểm tra và có thể tiếp nhận.</span>
                    </button>
                    <button type="button" aria-pressed={luaChon === "CanBoSung"} onClick={() => setLuaChon("CanBoSung")}
                      className={`rounded-lg border px-5 py-4 text-left text-sm transition-colors ${luaChon === "CanBoSung" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-[#dae3d9] text-[#607563] hover:bg-[#f7faf5]"}`}>
                      <span className="block font-semibold">Có thiếu sót cần bổ sung</span>
                      <span className="mt-1 block text-xs">Ghi nhận vấn đề và chưa xác nhận tiếp nhận.</span>
                    </button>
                  </div>
                  <label htmlFor="ghi-chu-ban-giao" className="mt-5 mb-2 block text-sm font-medium text-[#445949]">
                    Ghi chú {canGhiChu ? "(bắt buộc)" : "(không bắt buộc)"}
                  </label>
                  <textarea id="ghi-chu-ban-giao" rows={4} maxLength={500} value={ghiChu} onChange={(event) => setGhiChu(event.target.value)}
                    placeholder={luaChon === "CanBoSung" ? "Mô tả rõ thiếu sót cần bổ sung..." : "Ghi nhận tình trạng thực tế hoặc biện pháp đã xử lý..."}
                    className="w-full resize-y rounded-lg border border-[#dae3d9] bg-white px-4 py-3 text-sm text-[#30483a] placeholder:text-[#a0aea1]" />
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-[#859287]">
                      {Number(caChon?.coTheTiepNhan) !== 1 ? "Chỉ lưu được khi ca nhận đang diễn ra." : canGhiChu ? "Ghi chú ít nhất 5 ký tự." : "Kết quả sẽ được lưu theo thời điểm xác nhận."}
                    </p>
                    <button type="button" onClick={() => void guiKetQua()} disabled={!coTheLuu}
                      className="rounded-lg bg-[#30483a] px-6 py-3 text-sm font-semibold text-white hover:bg-[#45664d] disabled:cursor-not-allowed disabled:opacity-45">
                      {dangLuu ? "Đang lưu..." : luaChon === "DaTiepNhan" ? "Xác nhận tiếp nhận" : "Gửi nội dung cần bổ sung"}
                    </button>
                  </div>
                  {laNguoiCu && <p className="mt-3 text-sm text-amber-700">Không thể tự bàn giao và tiếp nhận cùng một vị trí.</p>}
                </>
              )}
            </section>
          )}

          <section className="overflow-hidden rounded-xl border border-[#e2e9e0] bg-white">
            <div className="border-b border-[#e9eee7] p-5 md:px-6">
              <h2 className="text-lg font-semibold text-[#30483a]">Lịch sử tiếp nhận của tôi</h2>
              <p className="mt-1 text-xs text-[#859287]">Ghi nhận theo từng phân công, không ghi đè kết quả đã tiếp nhận.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-[#edf3e9] text-xs text-[#4c644f]"><tr><th className="px-5 py-3">Ca / Ngày</th><th className="px-5 py-3">Vị trí</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3">Thời điểm tiếp nhận</th></tr></thead>
                <tbody className="divide-y divide-[#edf1eb]">
                  {duLieu.caCuaToi.filter((ca) => ca.maBanGiao).length === 0 ? (
                    <tr><td colSpan={4} className="px-5 py-5 text-[#859287]">Chưa có lần tiếp nhận bàn giao nào.</td></tr>
                  ) : duLieu.caCuaToi.filter((ca) => ca.maBanGiao).map((ca) => (
                    <tr key={ca.maBanGiao}>
                      <td className="px-5 py-3 text-[#30483a]">{ca.maCaNhan} · {ngayVN(ca.ngayNhan)}</td>
                      <td className="px-5 py-3 text-[#526655]">{ca.viTri}</td>
                      <td className="px-5 py-3 text-[#526655]">{moTaTrangThai(ca.trangThaiTiepNhan)}</td>
                      <td className="px-5 py-3 text-[#728175]">{ca.thoiGianTiepNhan?.replace(" ", " · ") ?? "Chưa xác nhận"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
