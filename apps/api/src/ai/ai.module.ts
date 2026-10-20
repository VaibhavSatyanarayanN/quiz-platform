import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { AiThrottlerGuard } from './guards/ai-throttler.guard.js';

@Module({
  imports: [HttpModule],
  controllers: [AiController],
  providers: [AiService, AiThrottlerGuard],
  exports: [AiService],
})
export class AiModule {}
