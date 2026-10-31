import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

import { HealthController } from './health.controller.js';
import { AiHealthIndicator } from './ai-health.indicator.js';
import { IS_PUBLIC_KEY } from '../modules/auth/decorators/public.decorator.js';

describe('HealthController', () => {
  let controller: HealthController;
  let mockHealthCheckService: {
    check: ReturnType<typeof vi.fn>;
  };
  let mockDbIndicator: {
    pingCheck: ReturnType<typeof vi.fn>;
  };
  let mockAiHealthIndicator: {
    isHealthy: ReturnType<typeof vi.fn>;
  };
  const reflector = new Reflector();

  beforeEach(() => {
    mockHealthCheckService = {
      check: vi.fn(async (indicators: (() => any)[]) => {
        const results = await Promise.all(indicators.map((fn) => fn()));
        const merged = Object.assign({}, ...results);
        const hasDown = Object.values(merged).some(
          (val: any) => val?.status === 'down',
        );
        return {
          status: hasDown ? 'error' : 'ok',
          info: merged,
          details: merged,
        };
      }),
    };

    mockDbIndicator = {
      pingCheck: vi.fn().mockResolvedValue({
        database: { status: 'up' },
      }),
    };

    mockAiHealthIndicator = {
      isHealthy: vi.fn(),
    };

    controller = new HealthController(
      mockHealthCheckService as unknown as HealthCheckService,
      mockDbIndicator as unknown as TypeOrmHealthIndicator,
      mockAiHealthIndicator as unknown as AiHealthIndicator,
    );
  });

  it('should have @Public() metadata so probe is unauthenticated', () => {
    const isPublic = reflector.get(IS_PUBLIC_KEY, controller.check);
    expect(isPublic).toBe(true);
  });

  it('should return ok when api, database, and ai are all up', async () => {
    mockAiHealthIndicator.isHealthy.mockResolvedValueOnce({
      ai: { status: 'up', service: 'ai' },
    });

    const res = await controller.check();
    expect(res.status).toBe('ok');
    expect(res.details.api.status).toBe('up');
    expect(res.details.database.status).toBe('up');
    expect(res.details.ai.status).toBe('up');
    expect(mockDbIndicator.pingCheck).toHaveBeenCalledWith('database');
  });

  it('should return error when database reports down', async () => {
    mockDbIndicator.pingCheck.mockResolvedValueOnce({
      database: { status: 'down', message: 'connection refused' },
    });
    mockAiHealthIndicator.isHealthy.mockResolvedValueOnce({
      ai: { status: 'up', service: 'ai' },
    });

    const res = await controller.check();
    expect(res.status).toBe('error');
    expect(res.details.database.status).toBe('down');
  });

  it('should return error when ai service reports down', async () => {
    mockAiHealthIndicator.isHealthy.mockResolvedValueOnce({
      ai: { status: 'down', message: 'connection refused' },
    });

    const res = await controller.check();
    expect(res.status).toBe('error');
    expect(res.details.ai.status).toBe('down');
  });
});
