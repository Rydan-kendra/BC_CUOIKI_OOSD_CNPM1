import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class GuiYeuCauDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maPhanCongGoc!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maCaDeXuat!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  lyDo!: string;
}
