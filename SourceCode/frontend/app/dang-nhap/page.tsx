"use client";

import { useEffect, useState } from "react";
import { keycloak, khoiTaoKeycloak } from "../../lib/keycloak";

export default function DangNhapPage() {
  const [dangTai, setDangTai] = useState(true);
  const [daDangNhap, setDaDangNhap] = useState(false);
  const [tenDangNhap, setTenDangNhap] = useState("");
  const [vaiTro, setVaiTro] = useState("");
  const [loi, setLoi] = useState("");
  const [ketQua, setKetQua] = useState("");
  const [dangKiemTra, setDangKiemTra] = useState(false);

  useEffect(() => {
    let conHoatDong = true;

    khoiTaoKeycloak()
      .then((authenticated) => {
        if (!conHoatDong) return;

        setDaDangNhap(authenticated);

        if (authenticated) {
          setTenDangNhap(
            String(keycloak.tokenParsed?.preferred_username ?? "")
          );

          setVaiTro(
            keycloak.hasRealmRole("QuanLy")
              ? "Quản lý"
              : keycloak.hasRealmRole("NhanVien")
                ? "Nhân viên"
                : "Chưa được phân quyền"
          );
        }
      })
      .catch(() => {
        if (conHoatDong) {
          setLoi("Không thể kết nối đến Keycloak.");
        }
      })
      .finally(() => {
        if (conHoatDong) {
          setDangTai(false);
        }
      });

    return () => {
      conHoatDong = false;
    };
  }, []);

  async function dangNhap() {
    await keycloak.login({
      redirectUri: "http://localhost:3000/dang-nhap",
    });
  }

  async function dangXuat() {
    await keycloak.logout({
      redirectUri: "http://localhost:3000/dang-nhap",
    });
  }

  async function kiemTraQuyen() {
    setDangKiemTra(true);
    setKetQua("");

    try {
      await keycloak.updateToken(30);

      if (!keycloak.token) {
        throw new Error("Không có access token. Vui lòng đăng nhập lại.");
      }

      const response = await fetch(
        "http://localhost:3001/nhan-su/kiem-tra-quyen",
        {
          headers: {
            Authorization: `Bearer ${keycloak.token}`,
          },
        }
      );

      if (response.status === 200) {
        setKetQua("HTTP 200: Có quyền quản lý nhân sự.");
      } else if (response.status === 403) {
        setKetQua("HTTP 403: Tài khoản không có quyền quản lý.");
      } else if (response.status === 401) {
        setKetQua("HTTP 401: Token chưa được xác thực.");
      } else {
        setKetQua(`HTTP ${response.status}: Kiểm tra thất bại.`);
      }
    } catch (error) {
      setKetQua(
        error instanceof Error
          ? error.message
          : "Không thể kết nối đến Backend."
      );
    } finally {
      setDangKiemTra(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl py-12">
      <div className="rounded-2xl border border-[#dce5da] bg-white p-8 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#718a72]">
          Xác thực tài khoản
        </p>

        <h1 className="mb-3 text-2xl font-bold text-[#30483a]">
          Đăng nhập hệ thống
        </h1>

        <p className="mb-8 text-sm text-[#778579]">
          Cổng quản lý ca trực và bàn giao vận hành
        </p>

        {dangTai ? (
          <p>Đang kiểm tra trạng thái đăng nhập...</p>
        ) : loi ? (
          <p role="alert" className="text-red-600">
            {loi}
          </p>
        ) : daDangNhap ? (
          <div className="space-y-5">
            <div className="rounded-lg bg-[#edf3eb] p-5">
              <p className="font-semibold text-[#30483a]">
                Đăng nhập thành công!
              </p>

              <p className="mt-3 text-sm">
                Tài khoản: {tenDangNhap}
              </p>

              <p className="mt-1 text-sm">
                Vai trò: {vaiTro}
              </p>
            </div>

            <button
              type="button"
              onClick={kiemTraQuyen}
              disabled={dangKiemTra}
              className="w-full rounded-lg bg-[#30483a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {dangKiemTra
                ? "Đang kiểm tra..."
                : "Kiểm tra quyền quản lý"}
            </button>

            {ketQua && (
              <div
                role="status"
                className="rounded-lg border border-[#dce5da] bg-[#f5f7f4] p-4 text-sm text-[#30483a]"
              >
                {ketQua}
              </div>
            )}

            <button
              type="button"
              onClick={dangXuat}
              className="rounded-lg border border-[#30483a] px-5 py-3 text-sm font-semibold text-[#30483a]"
            >
              Đăng xuất
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={dangNhap}
            className="w-full rounded-lg bg-[#30483a] px-5 py-3 font-semibold text-white hover:bg-[#45654e]"
          >
            Đăng nhập bằng Keycloak
          </button>
        )}
      </div>
    </main>
  );
}
