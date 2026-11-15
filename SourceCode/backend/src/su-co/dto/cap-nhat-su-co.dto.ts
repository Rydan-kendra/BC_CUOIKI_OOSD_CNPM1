import { IsBoolean, IsIn, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CapNhatSuCoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maSuCo!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  noiDungXuLy!: string;

  @IsIn(['ChuaHoanThanh', 'DangXuLy', 'DaXuLy'])
  trangThaiSau!: 'ChuaHoanThanh' | 'DangXuLy' | 'DaXuLy';

  @IsBoolean()
  canBanGiaoCaSau!: boolean;
}
