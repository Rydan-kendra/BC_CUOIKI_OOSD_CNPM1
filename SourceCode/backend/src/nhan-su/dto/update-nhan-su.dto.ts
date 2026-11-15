import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateNhanSuDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  hoTen?: string;

  @IsOptional()
  @IsIn(['BanThoiGian', 'ToanThoiGian', 'QuanLy'])
  loaiNhanSu?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10,15}$/)
  soDienThoai?: string;
}
