import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class SuaCaDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  ngayLam!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  gioBatDau!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  gioKetThuc!: string;
}

export class TaoCaDto extends SuaCaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maCa!: string;
}
