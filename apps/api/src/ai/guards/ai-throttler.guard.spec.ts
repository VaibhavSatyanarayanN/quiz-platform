import 'reflect-metadata';
import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AiThrottlerGuard } from './ai-throttler.guard.js';

describe('AiThrottlerGuard', () => {
  let guard: AiThrottlerGuard;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'AI_RATE_LIMIT_TTL_SECONDS' || key === 'AI_THROTTLE_TTL') {
          return 60;
        }
        if (key === 'AI_RATE_LIMIT_MAX' || key === 'AI_THROTTLE_LIMIT') {
          return 3; // Limit to 3 for testing
        }
        return undefined;
      }),
    };

    guard = new AiThrottlerGuard(mockConfigService as ConfigService);
  });

  function createMockContext(user?: { userId: string }, ip = '127.0.0.1') {
    const headers: Record<string, string> = {};
    const req = {
      user,
      ip,
      socket: { remoteAddress: ip },
    };
    const res = {
      setHeader: vi.fn((key: string, value: string) => {
        headers[key] = value;
      }),
    };

    return {
      context: {
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => res,
        }),
      } as unknown as ExecutionContext,
      headers,
    };
  }

  it('should allow requests within rate limit', () => {
    const { context } = createMockContext({ userId: 'user-1' });

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw 429 when limit is exceeded and set Retry-After header', () => {
    const { context, headers } = createMockContext({ userId: 'user-1' });

    guard.canActivate(context); // 1
    guard.canActivate(context); // 2
    guard.canActivate(context); // 3

    try {
      guard.canActivate(context); // 4 -> should throw
      expect.fail('Should have thrown 429');
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(headers['Retry-After']).toBeDefined();
      expect(Number(headers['Retry-After'])).toBeGreaterThan(0);
    }
  });

  it('should track separate limits for different users', () => {
    const ctx1 = createMockContext({ userId: 'user-A' });
    const ctx2 = createMockContext({ userId: 'user-B' });

    expect(guard.canActivate(ctx1.context)).toBe(true);
    expect(guard.canActivate(ctx1.context)).toBe(true);
    expect(guard.canActivate(ctx1.context)).toBe(true);

    // user-A is now at limit
    expect(() => guard.canActivate(ctx1.context)).toThrow();

    // user-B should still be allowed
    expect(guard.canActivate(ctx2.context)).toBe(true);
  });

  it('should fall back to IP tracking when user is unauthenticated', () => {
    const ctxIp1 = createMockContext(undefined, '192.168.1.100');
    const ctxIp2 = createMockContext(undefined, '192.168.1.101');

    expect(guard.canActivate(ctxIp1.context)).toBe(true);
    expect(guard.canActivate(ctxIp1.context)).toBe(true);
    expect(guard.canActivate(ctxIp1.context)).toBe(true);

    expect(() => guard.canActivate(ctxIp1.context)).toThrow();
    expect(guard.canActivate(ctxIp2.context)).toBe(true);
  });
});
