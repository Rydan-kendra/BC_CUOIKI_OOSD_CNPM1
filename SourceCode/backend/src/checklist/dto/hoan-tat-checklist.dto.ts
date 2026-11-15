import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class KetQuaMucDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maNoiDung!: string;

  @IsIn(['Dat', 'KhongDat'])
  ketQua!: 'Dat' | 'KhongDat';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ghiChu?: string;
}

export class HoanTatChecklistDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maPhanCong!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maDanhSach!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => KetQuaMucDto)
  ketQua!: KetQuaMucDto[];
}
