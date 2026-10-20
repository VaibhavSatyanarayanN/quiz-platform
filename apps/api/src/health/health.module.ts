import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller.js';
import { AiHealthIndicator } from './ai-health.indicator.js';

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [HealthController],
  providers: [AiHealthIndicator],
  exports: [AiHealthIndicator],
})
export class HealthModule {}
