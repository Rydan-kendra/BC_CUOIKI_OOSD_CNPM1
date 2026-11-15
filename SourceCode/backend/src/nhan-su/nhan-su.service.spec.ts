import { Test, TestingModule } from '@nestjs/testing';
import { NhanSuService } from './nhan-su.service.js';

describe('NhanSuService', () => {
  let service: NhanSuService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NhanSuService],
    }).compile();

    service = module.get<NhanSuService>(NhanSuService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
