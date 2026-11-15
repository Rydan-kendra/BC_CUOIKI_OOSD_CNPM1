
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateNhanSuDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maNhanSu!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  hoTen!: string;

  @IsIn(['BanThoiGian', 'ToanThoiGian', 'QuanLy'])
  loaiNhanSu!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10,15}$/)
  soDienThoai?: string;
}
