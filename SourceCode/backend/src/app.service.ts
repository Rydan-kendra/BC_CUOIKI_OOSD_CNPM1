
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(private readonly dataSource: DataSource) {}

  getHello(): string {
    return 'Hello World!';
  }

  async checkDatabase() {
    const database = await this.dataSource.query(
      'SELECT DB_NAME() AS tenDatabase',
    );

    const tables = await this.dataSource.query(
      "SELECT COUNT(*) AS soBang FROM sys.tables WHERE name <> 'sysdiagrams'",
    );

    return {
      trangThai: 'KetNoiThanhCong',
      tenDatabase: database[0].tenDatabase,
      soBangNghiepVu: tables[0].soBang,
    };
  }
}
