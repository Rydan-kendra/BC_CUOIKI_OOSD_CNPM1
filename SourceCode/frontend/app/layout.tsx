import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "./components/Sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cổng quản lý ca trực và bàn giao vận hành",
  description: "Hệ thống quản lý ca trực và bàn giao vận hành quán cà phê",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[#f0f3ef] text-[#29382e] antialiased`}
      >
        <div className="min-h-screen lg:flex">
          <Sidebar />

          <div className="min-w-0 flex-1 bg-[#f0f3ef]">
            <header className="flex h-16 items-center justify-between border-b border-[#e6e9e5] bg-white px-5 md:px-8">
              <div>
                <p className="text-sm font-semibold text-[#354a39]">
                  Quản trị vận hành
                </p>
                <p className="text-xs text-[#929b93]">
                  Cổng quản lý ca trực và bàn giao vận hành
                </p>
              </div>

              <div className="rounded-full border border-[#e3e8e2] bg-[#f6f8f5] px-4 py-2 text-xs text-[#536956]">
                Môi trường phát triển
              </div>
            </header>

            <div className="mx-auto w-full max-w-7xl p-5 md:p-8">
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
