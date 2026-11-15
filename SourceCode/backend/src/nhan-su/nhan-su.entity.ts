import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('NhanSu')
export class NhanSu {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  maNhanSu!: string;

  @Column({ type: 'nvarchar', length: 100 })
  hoTen!: string;

  @Column({ type: 'varchar', length: 30 })
  loaiNhanSu!: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  soDienThoai!: string | null;
}
