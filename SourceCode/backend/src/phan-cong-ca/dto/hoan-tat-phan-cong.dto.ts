import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class NguoiPhanCongDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maNhanSu!: string;

  @IsString()
  @IsIn([
    'Trưởng ca',
    'Pha chế',
    'Thu ngân',
    'Khu vực phục vụ',
  ])
  viTri!: string;
}

export class HoanTatPhanCongDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maCa!: string;

  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => NguoiPhanCongDto)
  phanCong!: NguoiPhanCongDto[];
}
