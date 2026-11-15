import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LapBienBanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maCaBanGiao!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  tongKetVanHanh!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  noiDungTonDong?: string;
}
