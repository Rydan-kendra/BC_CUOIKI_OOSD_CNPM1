
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { NhanSuModule } from './nhan-su/nhan-su.module.js';
import { CaLamViecModule } from './ca-lam-viec/ca-lam-viec.module.js';
import { PhanCongCaModule } from './phan-cong-ca/phan-cong-ca.module.js';
import { YeuCauDoiCaModule } from './yeu-cau-doi-ca/yeu-cau-doi-ca.module.js';
import { ChecklistModule } from './checklist/checklist.module.js';
import { BanGiaoViTriModule } from './ban-giao-vi-tri/ban-giao-vi-tri.module.js';
import { SuCoModule } from './su-co/su-co.module.js';
import { LichSuModule } from './lich-su/lich-su.module.js';
import { BanGiaoCaModule } from './ban-giao-ca/ban-giao-ca.module.js';
import { TongQuanModule } from './tong-quan/tong-quan.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mssql',
        host: configService.getOrThrow<string>('DB_HOST'),
        port: Number(configService.getOrThrow<string>('DB_PORT')),
        username: configService.getOrThrow<string>('DB_USERNAME'),
        password: configService.getOrThrow<string>('DB_PASSWORD'),
        database: configService.getOrThrow<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: false,
        options: {
          encrypt: false,
          trustServerCertificate: true,
        },
      }),
    }),
    NhanSuModule,
    CaLamViecModule,
    PhanCongCaModule,
    YeuCauDoiCaModule,
    ChecklistModule,
    BanGiaoViTriModule,
    SuCoModule,
    LichSuModule,
    BanGiaoCaModule,
    TongQuanModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
