import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class GhiNhanSuCoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maCa!: string;

  @IsIn(['Trưởng ca', 'Pha chế', 'Thu ngân', 'Khu vực phục vụ'])
  viTriPhatSinh!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, {
    message: 'Thời gian phát sinh phải có dạng YYYY-MM-DDTHH:mm',
  })
  thoiGianPhatSinh!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  noiDung!: string;

  @IsIn(['ThongThuong', 'QuanTrong'])
  mucDo!: 'ThongThuong' | 'QuanTrong';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bienPhapBanDau?: string;

  @IsOptional()
  @IsBoolean()
  canBanGiaoCaSau?: boolean;
}
