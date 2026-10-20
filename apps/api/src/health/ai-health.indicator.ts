import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import type { HealthIndicatorResult } from '@nestjs/terminus';

@Injectable()
export class AiHealthIndicator {
  private readonly logger = new Logger(AiHealthIndicator.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = (
      this.configService.get<string>('AI_SERVICE_URL') ??
      'http://127.0.0.1:8000'
    ).replace(/\/+$/, '');
  }

  async isHealthy(key = 'ai'): Promise<HealthIndicatorResult> {
    try {
      const response = await this.httpService.axiosRef.get(
        `${this.baseUrl}/health`,
        {
          // Short timeout (3 seconds) to prevent slow upstream hangs from blocking health checks
          timeout: 3000,
        },
      );

      const isUp =
        response.status === 200 && response.data?.status === 'ok';

      if (!isUp) {
        return {
          [key]: {
            status: 'down',
            message: 'Unexpected health status response from AI service.',
          },
        };
      }

      return {
        [key]: {
          status: 'up',
          service: response.data?.service ?? 'ai',
        },
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`AI service health probe failed: ${msg}`);
      return {
        [key]: {
          status: 'down',
          message: 'AI service is currently unreachable or non-responsive.',
        },
      };
    }
  }
}
