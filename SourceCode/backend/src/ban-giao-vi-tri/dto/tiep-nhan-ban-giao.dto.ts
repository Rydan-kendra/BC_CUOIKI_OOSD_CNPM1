import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class TiepNhanBanGiaoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maPhanCongNhan!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maLanKiemTra!: string;

  @IsIn(['DaTiepNhan', 'CanBoSung'])
  trangThaiTiepNhan!: 'DaTiepNhan' | 'CanBoSung';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ghiChu?: string;
}
