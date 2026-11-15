import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class PhanHoiBienBanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maBienBan!: string;

  @IsIn(['DaTiepNhan', 'CanBoSung'])
  ketQua!: 'DaTiepNhan' | 'CanBoSung';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ghiChu?: string;
}
