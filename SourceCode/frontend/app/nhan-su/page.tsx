"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { keycloak, khoiTaoKeycloak } from "../../lib/keycloak";
import { layAccessToken } from "../../lib/auth-api";

type NhanSu = {
  maNhanSu: string;
  hoTen: string;
  loaiNhanSu: string;
  soDienThoai: string | null;
};

type CheDo = "them" | "sua" | "xem" | null;

type FormNhanSu = {
  maNhanSu: string;
  hoTen: string;
  loaiNhanSu: string;
  soDienThoai: string;
};

const API = "http://localhost:3001/nhan-su";

const formRong: FormNhanSu = {
  maNhanSu: "",
  hoTen: "",
  loaiNhanSu: "BanThoiGian",
  soDienThoai: "",
};

function hienThiLoai(loai: string) {
  if (loai === "QuanLy") return "Quản lý";
  if (loai === "ToanThoiGian") return "Toàn thời gian";
  if (loai === "BanThoiGian") return "Bán thời gian";
  return loai;
}

export default function NhanSuPage() {
  const [danhSach, setDanhSach] = useState<NhanSu[]>([]);
  const [tuKhoa, setTuKhoa] = useState("");
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");
  const [thongBao, setThongBao] = useState("");

  const [daKiemTraDangNhap, setDaKiemTraDangNhap] = useState(false);
  const [daDangNhap, setDaDangNhap] = useState(false);
  const [laQuanLy, setLaQuanLy] = useState(false);
  const [tenDangNhap, setTenDangNhap] = useState("");

  const [cheDo, setCheDo] = useState<CheDo>(null);
  const [form, setForm] = useState<FormNhanSu>(formRong);
  const [dangLuu, setDangLuu] = useState(false);
  const [dangXoa, setDangXoa] = useState(false);
  const [loiForm, setLoiForm] = useState("");
  const [lanTai, setLanTai] = useState(0);

  useEffect(() => {
    let conHoatDong = true;

    khoiTaoKeycloak()
      .then((authenticated) => {
        if (!conHoatDong) return;

        setDaDangNhap(authenticated);

        setLaQuanLy(
          authenticated && keycloak.hasRealmRole("QuanLy")
        );

        setTenDangNhap(
          authenticated
            ? String(
                keycloak.tokenParsed?.preferred_username ?? ""
              )
            : ""
        );
      })
      .catch(() => {
        if (!conHoatDong) return;

        setDaDangNhap(false);
        setLaQuanLy(false);
        setLoi("Không thể kiểm tra đăng nhập Keycloak.");
      })
      .finally(() => {
        if (conHoatDong) {
          setDaKiemTraDangNhap(true);
        }
      });

    return () => {
      conHoatDong = false;
    };
  }, []);

  useEffect(() => {
    if (!daKiemTraDangNhap) return;

    if (!daDangNhap) {
      setDanhSach([]);
      setDangTai(false);
      return;
    }

    const controller = new AbortController();

    async function taiDanhSach() {
      setDangTai(true);
      setLoi("");

      try {
        const token = await layAccessToken();
        if (controller.signal.aborted) return;

        const params = new URLSearchParams();
        if (tuKhoa.trim()) {
          params.set("search", tuKhoa.trim());
        }

        const query = params.toString();
        const url = `${API}${query ? `?${query}` : ""}`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (response.status === 401) {
          throw new Error("Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
        }
        if (response.status === 403) {
          throw new Error("Tài khoản không có quyền xem danh sách nhân sự.");
        }
        if (!response.ok) {
          throw new Error("Không thể tải danh sách nhân sự.");
        }

        const data: NhanSu[] = await response.json();
        if (!controller.signal.aborted) {
          setDanhSach(data);
          setLoi("");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setDanhSach([]);
          setLoi(
            error instanceof Error
              ? error.message
              : "Không thể kết nối đến Backend NestJS."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setDangTai(false);
        }
      }
    }

    const timer = setTimeout(taiDanhSach, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [tuKhoa, lanTai, daKiemTraDangNhap, daDangNhap]);

  function taiLai() {
    setLanTai((giaTriCu) => giaTriCu + 1);
  }

  async function dangNhap() {
    await khoiTaoKeycloak();

    await keycloak.login({
      redirectUri: "http://localhost:3000/nhan-su",
    });
  }

  function moThem() {
    if (!laQuanLy) return;

    setForm({ ...formRong });
    setLoiForm("");
    setCheDo("them");
  }

  function moXem(nhanSu: NhanSu) {
    setForm({
      maNhanSu: nhanSu.maNhanSu,
      hoTen: nhanSu.hoTen,
      loaiNhanSu: nhanSu.loaiNhanSu,
      soDienThoai: nhanSu.soDienThoai ?? "",
    });

    setLoiForm("");
    setCheDo("xem");
  }

  function moSua(nhanSu: NhanSu) {
    if (!laQuanLy || nhanSu.loaiNhanSu === "QuanLy") {
      return;
    }

    setForm({
      maNhanSu: nhanSu.maNhanSu,
      hoTen: nhanSu.hoTen,
      loaiNhanSu: nhanSu.loaiNhanSu,
      soDienThoai: nhanSu.soDienThoai ?? "",
    });

    setLoiForm("");
    setCheDo("sua");
  }

  async function luuNhanSu(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!laQuanLy || (cheDo !== "them" && cheDo !== "sua")) {
      return;
    }

    setDangLuu(true);
    setLoiForm("");
    setThongBao("");

    try {
      const token = await layAccessToken();

      const duLieu = {
        hoTen: form.hoTen.trim(),
        loaiNhanSu: form.loaiNhanSu,
        ...(form.soDienThoai.trim()
          ? { soDienThoai: form.soDienThoai.trim() }
          : {}),
        ...(cheDo === "them"
          ? { maNhanSu: form.maNhanSu.trim() }
          : {}),
      };

      const url =
        cheDo === "them"
          ? API
          : `${API}/${encodeURIComponent(form.maNhanSu)}`;

      const response = await fetch(url, {
        method: cheDo === "them" ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(duLieu),
      });

      const ketQua = await response.json();

      if (!response.ok) {
        const thongDiep = Array.isArray(ketQua.message)
          ? ketQua.message.join(", ")
          : ketQua.message;

        throw new Error(
          thongDiep || `Không thể lưu nhân sự. HTTP ${response.status}`
        );
      }

      setThongBao(
        cheDo === "them"
          ? "Thêm nhân sự thành công."
          : "Cập nhật nhân sự thành công."
      );

      setCheDo(null);
      taiLai();
    } catch (error) {
      setLoiForm(
        error instanceof Error
          ? error.message
          : "Có lỗi khi lưu nhân sự."
      );
    } finally {
      setDangLuu(false);
    }
  }

  async function xoaNhanSu(nhanSu: NhanSu) {
    if (!laQuanLy || nhanSu.loaiNhanSu === "QuanLy") {
      return;
    }

    const dongY = window.confirm(
      `Bạn có chắc muốn xóa ${nhanSu.hoTen} (${nhanSu.maNhanSu}) không?`
    );

    if (!dongY) return;

    setDangXoa(true);
    setThongBao("");
    setLoi("");

    try {
      const token = await layAccessToken();

      const response = await fetch(
        `${API}/${encodeURIComponent(nhanSu.maNhanSu)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const ketQua = await response.json();

      if (!response.ok) {
        throw new Error(
          ketQua.message ||
            `Không thể xóa nhân sự. HTTP ${response.status}`
        );
      }

      setThongBao("Xóa nhân sự thành công.");
      taiLai();
    } catch (error) {
      setLoi(
        error instanceof Error
          ? error.message
          : "Không thể xóa nhân sự."
      );
    } finally {
      setDangXoa(false);
    }
  }

  const thongKe = [
    {
      ten: "Nhân sự hiển thị",
      giaTri: danhSach.length,
    },
    {
      ten: "Quản lý",
      giaTri: danhSach.filter(
        (item) => item.loaiNhanSu === "QuanLy"
      ).length,
    },
    {
      ten: "Toàn thời gian",
      giaTri: danhSach.filter(
        (item) => item.loaiNhanSu === "ToanThoiGian"
      ).length,
    },
    {
      ten: "Bán thời gian",
      giaTri: danhSach.filter(
        (item) => item.loaiNhanSu === "BanThoiGian"
      ).length,
    },
  ];

  const inputClass =
    "w-full rounded-lg border border-[#dce3da] bg-white px-4 py-3 text-sm text-[#29382e] outline-none focus:border-[#57735b] disabled:bg-[#f4f6f3]";

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#849386]">
            Quản lý nguồn lực
          </p>

          <h1 className="text-2xl font-bold text-[#283b2d] md:text-3xl">
            Quản lý nhân sự
          </h1>

          <p className="mt-2 text-sm text-[#849087]">
            Theo dõi nhân sự phục vụ phân công ca và bàn giao vận hành.
          </p>

          {daKiemTraDangNhap && daDangNhap && (
            <p className="mt-2 text-xs text-[#536956]">
              Đang đăng nhập: {tenDangNhap}
              {" · "}
              {laQuanLy ? "Quản lý" : "Nhân viên"}
            </p>
          )}
        </div>

        {!daKiemTraDangNhap ? (
          <span className="text-sm text-[#849087]">
            Đang kiểm tra đăng nhập...
          </span>
        ) : laQuanLy ? (
          <button
            type="button"
            onClick={moThem}
            className="rounded-lg bg-[#30483a] px-5 py-3 text-sm font-semibold text-white hover:bg-[#45654e]"
          >
            + Thêm nhân sự
          </button>
        ) : !daDangNhap ? (
          <button
            type="button"
            onClick={dangNhap}
            className="rounded-lg bg-[#30483a] px-5 py-3 text-sm font-semibold text-white hover:bg-[#45654e]"
          >
            Đăng nhập
          </button>
        ) : (
          <span className="rounded-lg bg-[#e2eae0] px-4 py-3 text-sm text-[#46654b]">
            Chế độ chỉ xem
          </span>
        )}
      </div>

      {thongBao && (
        <div
          role="status"
          className="rounded-lg border border-[#cbdcc9] bg-[#eaf3e8] px-5 py-3 text-sm text-[#365b3d]"
        >
          {thongBao}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {thongKe.map((item) => (
          <div
            key={item.ten}
            className="rounded-xl border border-[#e5eae4] bg-white p-5"
          >
            <p className="text-xs font-medium text-[#879388]">
              {item.ten}
            </p>

            <p className="mt-3 text-3xl font-semibold text-[#334b37]">
              {!daKiemTraDangNhap || !daDangNhap || dangTai || loi ? "—" : item.giaTri}
            </p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-[#e5eae4] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edf0ed] p-5">
          <div>
            <h2 className="text-base font-semibold text-[#2e4032]">
              Danh sách nhân sự
            </h2>

            <p className="mt-1 text-xs text-[#879388]">
              Dữ liệu từ SQL Server
            </p>
          </div>

          <input
            type="search"
            value={tuKhoa}
            onChange={(event) => setTuKhoa(event.target.value)}
            placeholder="Tìm theo mã hoặc họ tên..."
            aria-label="Tìm kiếm nhân sự"
            disabled={!daDangNhap}
            className="w-full rounded-lg border border-[#dce3da] bg-[#fbfcfb] px-4 py-3 text-sm outline-none focus:border-[#789077] md:w-80"
          />
        </div>

        {loi && (
          <p
            role="alert"
            className="m-5 rounded-lg bg-red-50 p-4 text-sm text-red-700"
          >
            {loi}
          </p>
        )}

        {!daKiemTraDangNhap ? (
          <p className="p-10 text-center text-sm text-[#879388]">
            Đang kiểm tra đăng nhập...
          </p>
        ) : !daDangNhap ? (
          <div className="p-10 text-center">
            <p className="mb-4 text-sm text-[#637165]">
              Bạn cần đăng nhập để xem danh sách nhân sự.
            </p>
            <button
              type="button"
              onClick={dangNhap}
              className="rounded-lg bg-[#30483a] px-5 py-3 text-sm font-semibold text-white hover:bg-[#45654e]"
            >
              Đăng nhập
            </button>
          </div>
        ) : dangTai ? (
          <p className="p-10 text-center text-sm text-[#879388]">
            Đang tải dữ liệu nhân sự...
          </p>
        ) : !loi ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#dce8da] text-[#30483a]">
                <tr>
                  <th className="px-5 py-4 font-bold">STT</th>
                  <th className="px-5 py-4 font-bold">Mã nhân sự</th>
                  <th className="px-5 py-4 font-bold">Họ và tên</th>
                  <th className="px-5 py-4 font-bold">Loại nhân sự</th>
                  <th className="px-5 py-4 font-bold">Số điện thoại</th>
                  <th className="px-5 py-4 text-center font-bold">
                    Thao tác
                  </th>
                </tr>
              </thead>

              <tbody>
                {danhSach.map((nhanSu, index) => (
                  <tr
                    key={nhanSu.maNhanSu}
                    className="border-t border-[#edf0ed] hover:bg-[#fafbf9]"
                  >
                    <td className="px-5 py-4 text-[#879388]">
                      {index + 1}
                    </td>

                    <td className="px-5 py-4 font-semibold text-[#3f6145]">
                      {nhanSu.maNhanSu}
                    </td>

                    <td className="px-5 py-4 text-[#344438]">
                      {nhanSu.hoTen}
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-block rounded-md bg-[#edf2eb] px-3 py-1 text-xs font-medium text-[#47664b]">
                        {hienThiLoai(nhanSu.loaiNhanSu)}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-[#637165]">
                      {nhanSu.soDienThoai ?? "Chưa cập nhật"}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => moXem(nhanSu)}
                          className="rounded-md border border-[#dbe5da] px-3 py-2 text-xs font-medium text-[#426249] hover:bg-[#edf2eb]"
                        >
                          Xem
                        </button>

                        {daKiemTraDangNhap &&
                          laQuanLy &&
                          nhanSu.loaiNhanSu !== "QuanLy" && (
                            <>
                              <button
                                type="button"
                                onClick={() => moSua(nhanSu)}
                                className="rounded-md border border-[#dbe5da] px-3 py-2 text-xs font-medium text-[#426249] hover:bg-[#edf2eb]"
                              >
                                Sửa
                              </button>

                              <button
                                type="button"
                                disabled={dangXoa}
                                onClick={() => xoaNhanSu(nhanSu)}
                                className="rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                Xóa
                              </button>
                            </>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {danhSach.length === 0 && (
              <p className="p-10 text-center text-sm text-[#879388]">
                Không tìm thấy nhân sự phù hợp.
              </p>
            )}
          </div>
        ) : null}
      </section>

      {cheDo !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tieu-de-form"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2
                id="tieu-de-form"
                className="text-xl font-bold text-[#30483a]"
              >
                {cheDo === "them"
                  ? "Thêm nhân sự"
                  : cheDo === "sua"
                    ? "Chỉnh sửa nhân sự"
                    : "Thông tin nhân sự"}
              </h2>

              <button
                type="button"
                onClick={() => setCheDo(null)}
                disabled={dangLuu}
                aria-label="Đóng biểu mẫu"
                className="rounded-md px-3 py-1 text-xl text-gray-500 hover:bg-gray-100"
              >
                ×
              </button>
            </div>

            <form onSubmit={luuNhanSu} className="space-y-4">
              <div>
                <label
                  htmlFor="maNhanSu"
                  className="mb-2 block text-sm font-medium"
                >
                  Mã nhân sự
                </label>

                <input
                  id="maNhanSu"
                  value={form.maNhanSu}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      maNhanSu: event.target.value,
                    })
                  }
                  disabled={cheDo !== "them" || dangLuu}
                  required
                  maxLength={20}
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="hoTen"
                  className="mb-2 block text-sm font-medium"
                >
                  Họ và tên
                </label>

                <input
                  id="hoTen"
                  value={form.hoTen}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      hoTen: event.target.value,
                    })
                  }
                  disabled={cheDo === "xem" || dangLuu}
                  required
                  maxLength={100}
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="loaiNhanSu"
                  className="mb-2 block text-sm font-medium"
                >
                  Loại nhân sự
                </label>

                <select
                  id="loaiNhanSu"
                  value={form.loaiNhanSu}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      loaiNhanSu: event.target.value,
                    })
                  }
                  disabled={cheDo === "xem" || dangLuu}
                  className={inputClass}
                >
                  {cheDo === "xem" &&
                    form.loaiNhanSu === "QuanLy" && (
                      <option value="QuanLy">Quản lý</option>
                    )}

                  <option value="BanThoiGian">
                    Bán thời gian
                  </option>

                  <option value="ToanThoiGian">
                    Toàn thời gian
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="soDienThoai"
                  className="mb-2 block text-sm font-medium"
                >
                  Số điện thoại
                </label>

                <input
                  id="soDienThoai"
                  type="tel"
                  value={form.soDienThoai}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      soDienThoai: event.target.value,
                    })
                  }
                  disabled={cheDo === "xem" || dangLuu}
                  pattern="[0-9]{10,15}"
                  maxLength={15}
                  placeholder="Nhập 10 đến 15 chữ số"
                  className={inputClass}
                />
              </div>

              {loiForm && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
                >
                  {loiForm}
                </p>
              )}

              <div className="flex justify-end gap-3 border-t border-[#edf0ed] pt-5">
                <button
                  type="button"
                  onClick={() => setCheDo(null)}
                  disabled={dangLuu}
                  className="rounded-lg border border-[#dce3da] px-5 py-2.5 text-sm"
                >
                  {cheDo === "xem" ? "Đóng" : "Hủy"}
                </button>

                {cheDo !== "xem" && (
                  <button
                    type="submit"
                    disabled={dangLuu}
                    className="rounded-lg bg-[#30483a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#45654e] disabled:opacity-50"
                  >
                    {dangLuu
                      ? "Đang lưu..."
                      : cheDo === "them"
                        ? "Thêm nhân sự"
                        : "Lưu thay đổi"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {!daDangNhap && daKiemTraDangNhap && (
        <p className="text-xs text-[#879388]">
          Bạn chưa đăng nhập.{" "}
          <Link
            href="/dang-nhap"
            className="font-semibold text-[#30483a] underline"
          >
            Đến trang đăng nhập
          </Link>
        </p>
      )}
    </main>
  );
}
