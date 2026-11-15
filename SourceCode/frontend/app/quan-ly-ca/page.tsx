"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { keycloak, khoiTaoKeycloak } from "../../lib/keycloak";
import { layAccessToken } from "../../lib/auth-api";

type CaLamViec = {
  maCa: string;
  ngayLam: string;
  gioBatDau: string;
  gioKetThuc: string;
  trangThai: string;
};

type FormSuaCa = {
  maCa: string;
  ngayLam: string;
  laCaSang: boolean;
  gioBatDau: string;
  gioKetThuc: string;
};

const API = "http://localhost:3001";

function gio(giaTri: string): string {
  return giaTri.slice(0, 5);
}

function hienThiNgay(ngayISO: string): string {
  const [nam, thang, ngay] = ngayISO.slice(0, 10).split("-");
  return `${ngay}/${thang}/${nam}`;
}

function laCaSang(ca: CaLamViec): boolean {
  return gio(ca.gioBatDau) < "14:00";
}

function hienThiTrangThai(trangThai: string): string {
  const ten: Record<string, string> = {
    ChuaPhanCong: "Chưa phân công",
    DaPhanCong: "Đã phân công",
    DangDienRa: "Đang diễn ra",
    ChoBanGiao: "Chờ bàn giao",
    DaKetThuc: "Đã kết thúc",
  };
  return ten[trangThai] ?? trangThai;
}

export default function QuanLyCaPage() {
  const [danhSach, setDanhSach] = useState<CaLamViec[]>([]);
  const [dangKiemTra, setDangKiemTra] = useState(true);
  const [daDangNhap, setDaDangNhap] = useState(false);
  const [laQuanLy, setLaQuanLy] = useState(false);
  const [dangTai, setDangTai] = useState(false);
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState("");
  const [thongBao, setThongBao] = useState("");
  const [locNgay, setLocNgay] = useState("");
  const [caDangSua, setCaDangSua] = useState<FormSuaCa | null>(null);

  async function layDanhSachCa() {
    const token = await layAccessToken();
    const response = await fetch(`${API}/ca-lam-viec`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok) {
      const thongDiep = Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message;
      throw new Error(thongDiep || `Không thể tải lịch ca (HTTP ${response.status}).`);
    }

    return data as CaLamViec[];
  }

  useEffect(() => {
    let hoatDong = true;

    async function khoiTao() {
      try {
        const authenticated = await khoiTaoKeycloak();
        if (!hoatDong) return;

        setDaDangNhap(authenticated);
        setLaQuanLy(authenticated && keycloak.hasRealmRole("QuanLy"));

        if (authenticated) {
          const data = await layDanhSachCa();
          if (hoatDong) setDanhSach(data);
        }
      } catch (error) {
        if (hoatDong) {
          setLoi(error instanceof Error ? error.message : "Không thể kết nối máy chủ.");
        }
      } finally {
        if (hoatDong) setDangKiemTra(false);
      }
    }

    khoiTao();

    return () => {
      hoatDong = false;
    };
  }, []);

  async function taiLai() {
    setDangTai(true);
    setLoi("");
    try {
      setDanhSach(await layDanhSachCa());
    } catch (error) {
      setLoi(error instanceof Error ? error.message : "Không thể tải danh sách ca.");
    } finally {
      setDangTai(false);
    }
  }

  async function dangNhap() {
    await khoiTaoKeycloak();
    await keycloak.login({ redirectUri: "http://localhost:3000/quan-ly-ca" });
  }

  function moSua(ca: CaLamViec) {
    if (!laQuanLy || ca.trangThai !== "ChuaPhanCong") return;
    setCaDangSua({
      maCa: ca.maCa,
      ngayLam: ca.ngayLam.slice(0, 10),
      laCaSang: laCaSang(ca),
      gioBatDau: gio(ca.gioBatDau),
      gioKetThuc: gio(ca.gioKetThuc),
    });
    setLoi("");
    setThongBao("");
  }

  async function luuCa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caDangSua || !laQuanLy) return;

    setDangLuu(true);
    setLoi("");
    setThongBao("");

    try {
      const token = await layAccessToken();
      const response = await fetch(
        `${API}/quan-ly-ca/${encodeURIComponent(caDangSua.maCa)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ngayLam: caDangSua.ngayLam,
            gioBatDau: caDangSua.gioBatDau,
            gioKetThuc: caDangSua.gioKetThuc,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        const thongDiep = Array.isArray(result.message)
          ? result.message.join(", ")
          : result.message;
        throw new Error(thongDiep || `Không thể cập nhật ca (HTTP ${response.status}).`);
      }

      setCaDangSua(null);
      setThongBao("Đã cập nhật thời gian ca thành công.");
      setDanhSach(await layDanhSachCa());
    } catch (error) {
      setLoi(error instanceof Error ? error.message : "Không thể lưu ca làm việc.");
    } finally {
      setDangLuu(false);
    }
  }

  const danhSachLoc = danhSach
    .filter((ca) => !locNgay || ca.ngayLam.slice(0, 10) === locNgay)
    .sort((a, b) =>
      `${a.ngayLam.slice(0, 10)} ${gio(a.gioBatDau)}`.localeCompare(
        `${b.ngayLam.slice(0, 10)} ${gio(b.gioBatDau)}`,
      ),
    );

  const soCaChuaPhanCong = danhSachLoc.filter(
    (ca) => ca.trangThai === "ChuaPhanCong",
  ).length;

  return (
    <main className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#849386]">
          Điều phối vận hành
        </p>
        <h1 className="text-2xl font-bold text-[#283b2d] md:text-3xl">
          Quản lý ca làm việc
        </h1>
        <p className="mt-2 text-sm text-[#849087]">
          Hệ thống tự bảo đảm ca sáng và ca chiều cho 30 ngày kể từ hôm nay.
          Quản lý chỉ sửa giờ ca chưa phân công khi có tình huống đặc biệt.
        </p>
      </div>

      {dangKiemTra ? (
        <section className="rounded-xl bg-white p-8">Đang kiểm tra đăng nhập...</section>
      ) : !daDangNhap ? (
        <section className="rounded-xl border border-[#e5eae4] bg-white p-8 text-center">
          <p className="mb-5 text-sm text-[#637165]">
            Bạn cần đăng nhập để xem lịch làm việc.
          </p>
          <button
            type="button"
            onClick={dangNhap}
            className="rounded-lg bg-[#30483a] px-5 py-3 text-sm font-semibold text-white"
          >
            Đăng nhập
          </button>
        </section>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Tổng số ca", danhSachLoc.length],
              ["Chưa phân công", soCaChuaPhanCong],
              ["Đã có phân công hoặc đang vận hành", danhSachLoc.length - soCaChuaPhanCong],
            ].map(([ten, so]) => (
              <div key={ten} className="rounded-xl border border-[#e5eae4] bg-white p-5">
                <p className="text-xs text-[#849087]">{ten}</p>
                <p className="mt-3 text-3xl font-semibold text-[#30483a]">{so}</p>
              </div>
            ))}
          </div>

          {!laQuanLy && (
            <div className="rounded-lg bg-[#e7eee5] px-5 py-3 text-sm text-[#426249]">
              Chế độ chỉ xem: chỉ tài khoản Quản lý được điều chỉnh giờ ca.
            </div>
          )}

          {thongBao && (
            <p role="status" className="rounded-lg border border-[#c9dfc9] bg-[#eaf3e8] px-5 py-3 text-sm text-[#35613f]">
              {thongBao}
            </p>
          )}
          {loi && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
              {loi}
            </p>
          )}

          <section className="overflow-hidden rounded-xl border border-[#e5eae4] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5eae4] p-5">
              <div>
                <h2 className="font-semibold text-[#30483a]">Danh sách ca làm việc</h2>
                <p className="mt-1 text-xs text-[#849087]">
                  Dữ liệu SQL Server · 2 ca mỗi ngày · chưa phân công thì có thể sửa giờ
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  aria-label="Lọc theo ngày"
                  type="date"
                  value={locNgay}
                  onChange={(event) => setLocNgay(event.target.value)}
                  className="rounded-lg border border-[#d9e2d7] px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setLocNgay("")}
                  className="rounded-lg border border-[#d9e2d7] px-3 py-2 text-sm text-[#30483a]"
                >
                  Tất cả
                </button>
                <Link
                  href="/phan-cong-ca"
                  className="rounded-lg bg-[#30483a] px-4 py-2 text-sm text-white"
                >
                  Đi đến phân công
                </Link>
                <button
                  type="button"
                  disabled={dangTai}
                  onClick={taiLai}
                  className="rounded-lg border border-[#d9e2d7] px-3 py-2 text-sm disabled:opacity-50"
                >
                  Tải lại
                </button>
              </div>
            </div>

            {dangTai ? (
              <p className="p-8 text-center text-sm text-[#849087]">Đang tải dữ liệu...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="bg-[#dce8da] text-[#30483a]">
                    <tr>
                      <th className="px-5 py-4">Mã ca</th>
                      <th className="px-5 py-4">Ngày làm</th>
                      <th className="px-5 py-4">Ca</th>
                      <th className="px-5 py-4">Khung giờ</th>
                      <th className="px-5 py-4">Trạng thái</th>
                      <th className="px-5 py-4">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {danhSachLoc.map((ca) => (
                      <tr key={ca.maCa} className="border-t border-[#edf0ed] hover:bg-[#fafbf9]">
                        <td className="px-5 py-4 font-semibold text-[#426249]">{ca.maCa}</td>
                        <td className="px-5 py-4">{hienThiNgay(ca.ngayLam)}</td>
                        <td className="px-5 py-4">{laCaSang(ca) ? "Ca sáng" : "Ca chiều"}</td>
                        <td className="px-5 py-4">{gio(ca.gioBatDau)}–{gio(ca.gioKetThuc)}</td>
                        <td className="px-5 py-4">
                          <span className="rounded-md bg-[#edf2eb] px-3 py-2 text-xs text-[#47664b]">
                            {hienThiTrangThai(ca.trangThai)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {laQuanLy && ca.trangThai === "ChuaPhanCong" ? (
                            <button
                              type="button"
                              onClick={() => moSua(ca)}
                              className="rounded-lg border border-[#d9e2d7] px-4 py-2 text-xs text-[#30483a] hover:bg-[#edf2eb]"
                            >
                              Sửa giờ
                            </button>
                          ) : (
                            <span className="text-xs text-[#849087]">Chỉ xem</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {danhSachLoc.length === 0 && (
                  <p className="p-8 text-center text-sm text-[#849087]">
                    Không có ca làm việc trong ngày đã chọn.
                  </p>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {caDangSua && laQuanLy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="tieu-de-sua-ca"
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 id="tieu-de-sua-ca" className="mb-5 text-xl font-bold text-[#30483a]">
              Sửa giờ ca {caDangSua.maCa}
            </h2>
            <form className="space-y-4" onSubmit={luuCa}>
              <div>
                <label htmlFor="ma-ca" className="mb-2 block text-sm font-medium">Mã ca</label>
                <input
                  id="ma-ca"
                  disabled
                  value={caDangSua.maCa}
                  className="w-full rounded-lg border border-[#dce3da] bg-[#f3f5f2] px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="ngay-lam" className="mb-2 block text-sm font-medium">Ngày làm việc</label>
                <input
                  id="ngay-lam"
                  type="date"
                  required
                  disabled
                  value={caDangSua.ngayLam}
                  className="w-full rounded-lg border border-[#dce3da] px-4 py-3 text-sm"
                />
              </div>
              <div className="rounded-lg bg-[#edf2eb] p-4 text-sm text-[#30483a]">
                <p className="font-semibold">{caDangSua.laCaSang ? "Ca sáng" : "Ca chiều"}</p>
                <p className="mt-1 text-xs text-[#657666]">
                  Khung mặc định: {caDangSua.laCaSang ? "06:00–14:00" : "14:00–22:00"}.
                  Chỉ điều chỉnh giờ trong phạm vi ca này.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="gio-vao" className="mb-2 block text-sm font-medium">Giờ bắt đầu</label>
                  <input
                    id="gio-vao"
                    type="time"
                    required
                    step={60}
                    min={caDangSua.laCaSang ? "06:00" : "14:00"}
                    max={caDangSua.laCaSang ? "13:59" : "21:59"}
                    disabled={dangLuu}
                    value={caDangSua.gioBatDau}
                    onChange={(event) => setCaDangSua({ ...caDangSua, gioBatDau: event.target.value })}
                    className="w-full rounded-lg border border-[#dce3da] px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="gio-ra" className="mb-2 block text-sm font-medium">Giờ kết thúc</label>
                  <input
                    id="gio-ra"
                    type="time"
                    required
                    step={60}
                    min={caDangSua.gioBatDau}
                    max={caDangSua.laCaSang ? "14:00" : "22:00"}
                    disabled={dangLuu}
                    value={caDangSua.gioKetThuc}
                    onChange={(event) => setCaDangSua({ ...caDangSua, gioKetThuc: event.target.value })}
                    className="w-full rounded-lg border border-[#dce3da] px-4 py-3 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-[#849087]">
                Chỉ sửa giờ của ca chưa phân công. Ngày làm việc cố định và không được trùng giờ ca khác.
              </p>
              <div className="flex justify-end gap-3 border-t border-[#edf0ed] pt-5">
                <button
                  type="button"
                  onClick={() => setCaDangSua(null)}
                  disabled={dangLuu}
                  className="rounded-lg border border-[#dce3da] px-5 py-2.5 text-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={dangLuu}
                  className="rounded-lg bg-[#30483a] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {dangLuu ? "Đang lưu..." : "Lưu ca"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
