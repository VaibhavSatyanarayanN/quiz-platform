import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

import { Public } from '../modules/auth/decorators/public.decorator.js';
import { AiHealthIndicator } from './ai-health.indicator.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly aiHealthIndicator: AiHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  check() {
    return this.health.check([
      async (): Promise<HealthIndicatorResult> => ({
        api: {
          status: 'up',
        },
      }),
      () => this.db.pingCheck('database'),
      () => this.aiHealthIndicator.isHealthy('ai'),
    ]);
  }
}
