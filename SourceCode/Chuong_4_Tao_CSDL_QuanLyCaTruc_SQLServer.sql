IF DB_ID(N'QuanLyCaTrucBanGiao') IS NULL
BEGIN
    CREATE DATABASE QuanLyCaTrucBanGiao;
END
GO
USE QuanLyCaTrucBanGiao;
GO

CREATE TABLE NhanSu (
    maNhanSu VARCHAR(20) NOT NULL PRIMARY KEY,
    hoTen NVARCHAR(100) NOT NULL,
    loaiNhanSu VARCHAR(30) NOT NULL,
    soDienThoai VARCHAR(15) NULL,
    CONSTRAINT CK_NhanSu_Loai CHECK (loaiNhanSu IN ('BanThoiGian', 'ToanThoiGian', 'QuanLy'))
);
GO

CREATE TABLE TaiKhoan (
    maTaiKhoan VARCHAR(20) NOT NULL PRIMARY KEY,
    maNhanSu VARCHAR(20) NOT NULL UNIQUE,
    tenDangNhap VARCHAR(60) NOT NULL UNIQUE,
    matKhauHash VARCHAR(255) NOT NULL,
    nhomQuyen VARCHAR(30) NOT NULL,
    trangThai VARCHAR(20) NOT NULL DEFAULT 'HoatDong',
    CONSTRAINT FK_TaiKhoan_NhanSu FOREIGN KEY (maNhanSu) REFERENCES NhanSu(maNhanSu),
    CONSTRAINT CK_TaiKhoan_NhomQuyen CHECK (nhomQuyen IN ('NhanVien','QuanLy')),
    CONSTRAINT CK_TaiKhoan_TrangThai CHECK (trangThai IN ('HoatDong','VoHieuHoa'))
);
GO

CREATE TABLE CaLamViec (
    maCa VARCHAR(20) NOT NULL PRIMARY KEY,
    ngayLam DATE NOT NULL,
    gioBatDau TIME NOT NULL,
    gioKetThuc TIME NOT NULL,
    trangThai VARCHAR(30) NOT NULL DEFAULT 'ChuaPhanCong',
    CONSTRAINT CK_CaLamViec_Gio CHECK (gioBatDau < gioKetThuc),
    CONSTRAINT CK_CaLamViec_TrangThai CHECK (trangThai IN ('ChuaPhanCong','DaPhanCong','DangDienRa','ChoBanGiao','DaKetThuc'))
);
GO

CREATE TABLE PhanCongCa (
    maPhanCong VARCHAR(20) NOT NULL PRIMARY KEY,
    maCa VARCHAR(20) NOT NULL,
    maNhanSu VARCHAR(20) NOT NULL,
    viTri NVARCHAR(40) NOT NULL,
    ngayPhanCong DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_PhanCongCa_Ca FOREIGN KEY (maCa) REFERENCES CaLamViec(maCa),
    CONSTRAINT FK_PhanCongCa_NhanSu FOREIGN KEY (maNhanSu) REFERENCES NhanSu(maNhanSu),
    CONSTRAINT UQ_PhanCongCa_NhanSu UNIQUE (maCa, maNhanSu),
    CONSTRAINT UQ_PhanCongCa_ViTri UNIQUE (maCa, viTri),
    CONSTRAINT CK_PhanCongCa_ViTri CHECK (viTri IN (N'Pha chế',N'Thu ngân',N'Khu vực phục vụ',N'Trưởng ca'))
);
GO

CREATE TABLE YeuCauDoiCa (
    maYeuCau VARCHAR(20) NOT NULL PRIMARY KEY,
    maNhanSuGui VARCHAR(20) NOT NULL,
    maPhanCongGoc VARCHAR(20) NOT NULL,
    maCaDeXuat VARCHAR(20) NOT NULL,
    maTaiKhoanDuyet VARCHAR(20) NULL,
    lyDo NVARCHAR(500) NOT NULL,
    trangThai VARCHAR(30) NOT NULL DEFAULT 'ChoXetDuyet',
    thoiGianGui DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    thoiGianXuLy DATETIME2 NULL,
    CONSTRAINT FK_YeuCauDoiCa_NhanSu FOREIGN KEY (maNhanSuGui) REFERENCES NhanSu(maNhanSu),
    CONSTRAINT FK_YeuCauDoiCa_PhanCong FOREIGN KEY (maPhanCongGoc) REFERENCES PhanCongCa(maPhanCong),
    CONSTRAINT FK_YeuCauDoiCa_CaDeXuat FOREIGN KEY (maCaDeXuat) REFERENCES CaLamViec(maCa),
    CONSTRAINT FK_YeuCauDoiCa_NguoiDuyet FOREIGN KEY (maTaiKhoanDuyet) REFERENCES TaiKhoan(maTaiKhoan),
    CONSTRAINT CK_YeuCauDoiCa_TrangThai CHECK (trangThai IN ('ChoXetDuyet','DaChapThuan','DaTuChoi'))
);
GO

CREATE TABLE DanhSachKiemTra (
    maDanhSach VARCHAR(20) NOT NULL PRIMARY KEY,
    viTri NVARCHAR(40) NOT NULL,
    tenDanhSach NVARCHAR(150) NOT NULL,
    CONSTRAINT CK_DanhSachKiemTra_ViTri CHECK (viTri IN (N'Pha chế',N'Thu ngân',N'Khu vực phục vụ'))
);
GO

CREATE TABLE NoiDungKiemTra (
    maNoiDung VARCHAR(20) NOT NULL PRIMARY KEY,
    maDanhSach VARCHAR(20) NOT NULL,
    noiDung NVARCHAR(500) NOT NULL,
    thuTu INT NOT NULL,
    CONSTRAINT FK_NoiDungKiemTra_DanhSach FOREIGN KEY (maDanhSach) REFERENCES DanhSachKiemTra(maDanhSach),
    CONSTRAINT UQ_NoiDungKiemTra_ThuTu UNIQUE (maDanhSach, thuTu),
    CONSTRAINT CK_NoiDungKiemTra_ThuTu CHECK (thuTu > 0)
);
GO

CREATE TABLE LanKiemTra (
    maLan VARCHAR(20) NOT NULL PRIMARY KEY,
    maDanhSach VARCHAR(20) NOT NULL,
    maPhanCong VARCHAR(20) NOT NULL,
    thoiGianHoanTat DATETIME2 NULL,
    trangThai VARCHAR(30) NOT NULL DEFAULT 'DangThucHien',
    CONSTRAINT FK_LanKiemTra_DanhSach FOREIGN KEY (maDanhSach) REFERENCES DanhSachKiemTra(maDanhSach),
    CONSTRAINT FK_LanKiemTra_PhanCong FOREIGN KEY (maPhanCong) REFERENCES PhanCongCa(maPhanCong),
    CONSTRAINT CK_LanKiemTra_TrangThai CHECK (trangThai IN ('DangThucHien','DaHoanTat'))
);
GO

CREATE TABLE KetQuaKiemTra (
    maKetQua VARCHAR(20) NOT NULL PRIMARY KEY,
    maLan VARCHAR(20) NOT NULL,
    maNoiDung VARCHAR(20) NOT NULL,
    ketQua VARCHAR(30) NOT NULL,
    ghiChu NVARCHAR(500) NULL,
    CONSTRAINT FK_KetQuaKiemTra_Lan FOREIGN KEY (maLan) REFERENCES LanKiemTra(maLan),
    CONSTRAINT FK_KetQuaKiemTra_NoiDung FOREIGN KEY (maNoiDung) REFERENCES NoiDungKiemTra(maNoiDung),
    CONSTRAINT UQ_KetQuaKiemTra_Muc UNIQUE (maLan, maNoiDung),
    CONSTRAINT CK_KetQuaKiemTra_KetQua CHECK (ketQua IN ('Dat','KhongDat'))
);
GO

CREATE TABLE BanGiaoTheoViTri (
    maBanGiao VARCHAR(20) NOT NULL PRIMARY KEY,
    maPhanCongGiao VARCHAR(20) NOT NULL,
    maPhanCongNhan VARCHAR(20) NOT NULL,
    maLanKiemTra VARCHAR(20) NOT NULL,
    trangThaiTiepNhan VARCHAR(40) NOT NULL DEFAULT 'ChoTiepNhan',
    ghiChu NVARCHAR(500) NULL,
    thoiGianTiepNhan DATETIME2 NULL,
    CONSTRAINT FK_BanGiaoTheoViTri_NguoiGiao FOREIGN KEY (maPhanCongGiao) REFERENCES PhanCongCa(maPhanCong),
    CONSTRAINT FK_BanGiaoTheoViTri_NguoiNhan FOREIGN KEY (maPhanCongNhan) REFERENCES PhanCongCa(maPhanCong),
    CONSTRAINT FK_BanGiaoTheoViTri_LanKiemTra FOREIGN KEY (maLanKiemTra) REFERENCES LanKiemTra(maLan),
    CONSTRAINT UQ_BanGiaoTheoViTri_NguoiGiao UNIQUE (maPhanCongGiao),
    CONSTRAINT UQ_BanGiaoTheoViTri_NguoiNhan UNIQUE (maPhanCongNhan),
    CONSTRAINT CK_BanGiaoTheoViTri_KhacNguoi CHECK (maPhanCongGiao <> maPhanCongNhan),
    CONSTRAINT CK_BanGiaoTheoViTri_TrangThai CHECK (trangThaiTiepNhan IN ('ChoTiepNhan','DaTiepNhan','CanBoSung'))
);
GO

CREATE TABLE SuCo (
    maSuCo VARCHAR(20) NOT NULL PRIMARY KEY,
    maCa VARCHAR(20) NOT NULL,
    maNhanSuBaoCao VARCHAR(20) NOT NULL,
    noiDung NVARCHAR(MAX) NOT NULL,
    mucDo VARCHAR(30) NOT NULL,
    trangThai VARCHAR(30) NOT NULL DEFAULT 'ChuaHoanThanh',
    canBanGiaoCaSau BIT NOT NULL DEFAULT 0,
    CONSTRAINT FK_SuCo_Ca FOREIGN KEY (maCa) REFERENCES CaLamViec(maCa),
    CONSTRAINT FK_SuCo_NhanSu FOREIGN KEY (maNhanSuBaoCao) REFERENCES NhanSu(maNhanSu),
    CONSTRAINT CK_SuCo_MucDo CHECK (mucDo IN ('ThongThuong','QuanTrong')),
    CONSTRAINT CK_SuCo_TrangThai CHECK (trangThai IN ('ChuaHoanThanh','DangXuLy','DaXuLy'))
);
GO

CREATE TABLE LichSuXuLySuCo (
    maCapNhat VARCHAR(20) NOT NULL PRIMARY KEY,
    maSuCo VARCHAR(20) NOT NULL,
    maTaiKhoanCapNhat VARCHAR(20) NOT NULL,
    noiDungXuLy NVARCHAR(MAX) NOT NULL,
    trangThaiSau VARCHAR(30) NOT NULL,
    thoiGianCapNhat DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_LichSuXuLySuCo_SuCo FOREIGN KEY (maSuCo) REFERENCES SuCo(maSuCo),
    CONSTRAINT FK_LichSuXuLySuCo_TaiKhoan FOREIGN KEY (maTaiKhoanCapNhat) REFERENCES TaiKhoan(maTaiKhoan),
    CONSTRAINT CK_LichSuXuLySuCo_TrangThai CHECK (trangThaiSau IN ('ChuaHoanThanh','DangXuLy','DaXuLy'))
);
GO

CREATE TABLE BienBanBanGiaoCa (
    maBienBan VARCHAR(20) NOT NULL PRIMARY KEY,
    maCaBanGiao VARCHAR(20) NOT NULL,
    maCaTiepNhan VARCHAR(20) NOT NULL,
    maPhanCongGiao VARCHAR(20) NOT NULL,
    maPhanCongNhan VARCHAR(20) NOT NULL,
    tongKetVanHanh NVARCHAR(MAX) NOT NULL,
    noiDungTonDong NVARCHAR(MAX) NULL,
    trangThai VARCHAR(30) NOT NULL DEFAULT 'ChoTiepNhan',
    thoiGianLap DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    thoiGianTiepNhan DATETIME2 NULL,
    CONSTRAINT FK_BienBanBanGiaoCa_CaGiao FOREIGN KEY (maCaBanGiao) REFERENCES CaLamViec(maCa),
    CONSTRAINT FK_BienBanBanGiaoCa_CaNhan FOREIGN KEY (maCaTiepNhan) REFERENCES CaLamViec(maCa),
    CONSTRAINT FK_BienBanBanGiaoCa_PhanCongGiao FOREIGN KEY (maPhanCongGiao) REFERENCES PhanCongCa(maPhanCong),
    CONSTRAINT FK_BienBanBanGiaoCa_PhanCongNhan FOREIGN KEY (maPhanCongNhan) REFERENCES PhanCongCa(maPhanCong),
    CONSTRAINT UQ_BienBanBanGiaoCa_CaGiao UNIQUE (maCaBanGiao),
    CONSTRAINT UQ_BienBanBanGiaoCa_CaNhan UNIQUE (maCaTiepNhan),
    CONSTRAINT CK_BienBanBanGiaoCa_KhacCa CHECK (maCaBanGiao <> maCaTiepNhan),
    CONSTRAINT CK_BienBanBanGiaoCa_TrangThai CHECK (trangThai IN ('ChoTiepNhan','DaTiepNhan'))
);
GO

SELECT t.name AS TenBang, COUNT(c.column_id) AS SoCot
FROM sys.tables AS t
JOIN sys.columns AS c ON c.object_id = t.object_id
GROUP BY t.name
ORDER BY t.name;
GO
