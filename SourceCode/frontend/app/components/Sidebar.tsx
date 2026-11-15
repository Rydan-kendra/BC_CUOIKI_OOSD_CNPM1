
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { keycloak, khoiTaoKeycloak } from "../../lib/keycloak";

type MucMenu = {
  ten: string;
  duongDan: string;
  kyHieu: string;
  daCoTrang: boolean;
};

const menuChung: MucMenu[] = [
  { ten: "Tổng quan", duongDan: "/tong-quan", kyHieu: "▦", daCoTrang: true },
  { ten: "Lịch làm việc", duongDan: "/lich-lam-viec", kyHieu: "▤", daCoTrang: true },
];

const menuQuanLy: MucMenu[] = [
  { ten: "Quản lý ca", duongDan: "/quan-ly-ca", kyHieu: "▣", daCoTrang: true },
  { ten: "Phân công ca", duongDan: "/phan-cong-ca", kyHieu: "◫", daCoTrang: true },
  { ten: "Xét duyệt đổi ca", duongDan: "/xu-ly-doi-ca", kyHieu: "⇄", daCoTrang: true },
  { ten: "Quản lý sự cố", duongDan: "/su-co", kyHieu: "⚑", daCoTrang: true },
  { ten: "Bàn giao ca", duongDan: "/ban-giao", kyHieu: "⇢", daCoTrang: true },
  { ten: "Quản lý nhân sự", duongDan: "/nhan-su", kyHieu: "♙", daCoTrang: true },
];

const menuNhanVien: MucMenu[] = [
  { ten: "Yêu cầu đổi ca", duongDan: "/yeu-cau-doi-ca", kyHieu: "⇄", daCoTrang: true },
  { ten: "Checklist", duongDan: "/checklist", kyHieu: "☑", daCoTrang: true },
  { ten: "Bàn giao vị trí", duongDan: "/ban-giao-vi-tri", kyHieu: "⇥", daCoTrang: true },
  { ten: "Ghi nhận sự cố", duongDan: "/su-co", kyHieu: "⚑", daCoTrang: true },
  { ten: "Bàn giao ca (Trưởng ca)", duongDan: "/ban-giao", kyHieu: "⇢", daCoTrang: true },
];

const menuCuoi: MucMenu[] = [
  { ten: "Tra cứu lịch sử", duongDan: "/lich-su", kyHieu: "◷", daCoTrang: true },
];

type TrangThai = "dangKiemTra" | "daDangNhap" | "chuaDangNhap" | "loi";

export default function Sidebar() {
  const pathname = usePathname();

  const [trangThai, setTrangThai] =
    useState<TrangThai>("dangKiemTra");

  const [tenTaiKhoan, setTenTaiKhoan] = useState("");
  const [vaiTro, setVaiTro] = useState("");
  const [nhomQuyen, setNhomQuyen] = useState<"QuanLy" | "NhanVien" | "Khac" | null>(null);
  const [dangXuLy, setDangXuLy] = useState(false);
  const [loiTaiKhoan, setLoiTaiKhoan] = useState("");

  useEffect(() => {
    let hoatDong = true;

    async function kiemTraTaiKhoan() {
      try {
        const authenticated = await khoiTaoKeycloak();

        if (!hoatDong) return;

        if (!authenticated) {
          setNhomQuyen(null);
          setTrangThai("chuaDangNhap");
          return;
        }

        const thongTin = keycloak.tokenParsed;

        setTenTaiKhoan(
          thongTin?.preferred_username ||
            thongTin?.name ||
            "Tài khoản",
        );

        if (keycloak.hasRealmRole("QuanLy")) {
          setNhomQuyen("QuanLy");
          setVaiTro("Quản lý cửa hàng");
        } else if (keycloak.hasRealmRole("NhanVien")) {
          setNhomQuyen("NhanVien");
          setVaiTro("Nhân viên");
        } else {
          setNhomQuyen("Khac");
          setVaiTro("Chưa xác định quyền");
        }

        setTrangThai("daDangNhap");
      } catch {
        if (hoatDong) {
          setTrangThai("loi");
          setLoiTaiKhoan("Không thể kết nối Keycloak.");
        }
      }
    }

    void kiemTraTaiKhoan();

    return () => {
      hoatDong = false;
    };
  }, []);

  async function dangNhap() {
    setDangXuLy(true);
    setLoiTaiKhoan("");

    try {
      await khoiTaoKeycloak();

      await keycloak.login({
        redirectUri: window.location.href,
      });
    } catch {
      setLoiTaiKhoan("Không thể chuyển đến trang đăng nhập.");
      setDangXuLy(false);
    }
  }

  async function dangXuat() {
    setDangXuLy(true);
    setLoiTaiKhoan("");

    try {
      await keycloak.logout({
        redirectUri: `${window.location.origin}/dang-nhap`,
      });
    } catch {
      setLoiTaiKhoan("Đăng xuất thất bại. Vui lòng thử lại.");
      setDangXuLy(false);
    }
  }

  const menuHienThi = trangThai !== "daDangNhap" ? [] :
    nhomQuyen === "QuanLy"
      ? [...menuChung, ...menuQuanLy, ...menuCuoi]
      : nhomQuyen === "NhanVien"
        ? [...menuChung, ...menuNhanVien, ...menuCuoi]
        : [];

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-[#263b30] bg-[#30483a] lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:self-start lg:border-b-0 lg:border-r">

      <div className="shrink-0 border-b border-white/10 px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#688369]">
            <Image
              src="/logo.png"
              alt="Logo quản lý ca trực và bàn giao vận hành"
              fill
              sizes="48px"
              className="object-contain"
              priority
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="whitespace-nowrap text-[13px] font-bold tracking-wide text-white">
              CỔNG QUẢN LÝ CA
            </p>

            <p className="whitespace-nowrap text-xs text-[#c3d0c5]">
              Vận hành & bàn giao
            </p>
          </div>
        </div>
      </div>

      <nav
        className="min-h-0 px-3 py-5 lg:flex-1 lg:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Điều hướng chính"
      >
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-[#b9cdbb]">
          {nhomQuyen === "QuanLy" && trangThai === "daDangNhap" ? "Chức năng quản lý" :
            nhomQuyen === "NhanVien" && trangThai === "daDangNhap" ? "Chức năng nhân viên" : "Chức năng hệ thống"}
        </p>

        <div className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-x-visible">
          {menuHienThi.map((item) => {
            const active = pathname === item.duongDan;

            const classes = `flex shrink-0 items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors ${
              active
                ? "bg-[#57735b] font-semibold text-white"
                : item.daCoTrang
                  ? "text-[#d6e3d8] hover:bg-white/10 hover:text-white"
                  : "cursor-not-allowed text-[#b4c6b7]"
            }`;

            const noiDung = (
              <>
                <span className="w-5 shrink-0 text-center text-lg">
                  {item.kyHieu}
                </span>

                <span className="whitespace-nowrap">
                  {item.ten}
                </span>
              </>
            );

            if (!item.daCoTrang) {
              return (
                <span
                  key={item.duongDan}
                  className={classes}
                  title="Chức năng sẽ được xây dựng"
                  aria-disabled="true"
                >
                  {noiDung}
                </span>
              );
            }

            return (
              <Link
                key={item.duongDan}
                href={item.duongDan}
                className={classes}
              >
                {noiDung}
              </Link>
            );
          })}
          {trangThai === "dangKiemTra" && (
            <p className="px-3 py-2 text-xs text-[#c3d0c5]">Đang xác định quyền truy cập...</p>
          )}
          {trangThai === "chuaDangNhap" && (
            <p className="px-3 py-2 text-xs text-[#c3d0c5]">Đăng nhập để xem các chức năng phù hợp.</p>
          )}
          {trangThai === "daDangNhap" && nhomQuyen === "Khac" && (
            <p className="px-3 py-2 text-xs text-[#ffcbcb]">Tài khoản chưa được phân quyền.</p>
          )}
        </div>
      </nav>

      <div className="shrink-0 border-t border-white/10 bg-[#2b4034] px-4 py-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[#b9cdbb]">
          Tài khoản hệ thống
        </p>

        {trangThai === "dangKiemTra" && (
          <p className="text-xs text-[#c3d0c5]">
            Đang kiểm tra đăng nhập...
          </p>
        )}

        {trangThai === "daDangNhap" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#57735b] text-lg text-white">
                ♙
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-semibold text-white"
                  title={tenTaiKhoan}
                >
                  {tenTaiKhoan}
                </p>

                <p className="text-xs text-[#c3d0c5]">
                  {vaiTro}
                </p>
              </div>

              <span className="h-2 w-2 rounded-full bg-[#8cc795]" />
            </div>

            <button
              type="button"
              onClick={dangXuat}
              disabled={dangXuLy}
              className="w-full rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {dangXuLy ? "Đang đăng xuất..." : "Đăng xuất"}
            </button>
          </div>
        )}

        {trangThai === "chuaDangNhap" && (
          <div className="space-y-3">
            <p className="text-xs text-[#c3d0c5]">
              Bạn chưa đăng nhập hệ thống.
            </p>

            <button
              type="button"
              onClick={dangNhap}
              disabled={dangXuLy}
              className="w-full rounded-lg bg-[#57735b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#68896d] disabled:opacity-50"
            >
              {dangXuLy ? "Đang chuyển..." : "Đăng nhập"}
            </button>
          </div>
        )}

        {trangThai === "loi" && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded-lg border border-white/20 px-4 py-2 text-xs text-white"
          >
            Thử kết nối lại
          </button>
        )}

        {loiTaiKhoan && (
          <p role="alert" className="mt-3 text-xs text-[#ffcbcb]">
            {loiTaiKhoan}
          </p>
        )}
      </div>
    </aside>
  );
}
