
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('CaLamViec')
export class CaLamViec {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  maCa!: string;

  @Column({ type: 'date' })
  ngayLam!: string;

  @Column({ type: 'time' })
  gioBatDau!: string;

  @Column({ type: 'time' })
  gioKetThuc!: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: 'ChuaPhanCong',
  })
  trangThai!: string;
}
