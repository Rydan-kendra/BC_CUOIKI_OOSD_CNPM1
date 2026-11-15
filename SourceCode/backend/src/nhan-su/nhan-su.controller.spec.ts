import { Test, TestingModule } from '@nestjs/testing';
import { NhanSuController } from './nhan-su.controller.js';

describe('NhanSuController', () => {
  let controller: NhanSuController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NhanSuController],
    }).compile();

    controller = module.get<NhanSuController>(NhanSuController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
