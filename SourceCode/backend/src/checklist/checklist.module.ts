import { Module } from '@nestjs/common';
import { XacThucGuard } from '../auth/xac-thuc.guard.js';
import { ChecklistController } from './checklist.controller.js';
import { ChecklistService } from './checklist.service.js';

@Module({
  controllers: [ChecklistController],
  providers: [ChecklistService, XacThucGuard],
})
export class ChecklistModule {}
