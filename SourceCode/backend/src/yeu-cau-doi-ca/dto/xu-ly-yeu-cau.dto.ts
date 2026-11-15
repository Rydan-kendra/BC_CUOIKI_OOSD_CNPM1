import { IsIn, IsNotEmpty, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class XuLyYeuCauDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maYeuCau!: string;

  @IsIn(['DaChapThuan', 'DaTuChoi'])
  ketQua!: 'DaChapThuan' | 'DaTuChoi';

  @ValidateIf((dto: XuLyYeuCauDto) => dto.ketQua === 'DaChapThuan')
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maPhanCongDoi?: string;

  @ValidateIf((dto: XuLyYeuCauDto) => dto.ketQua === 'DaTuChoi')
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  lyDoTuChoi?: string;
}
