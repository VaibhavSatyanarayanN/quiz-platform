import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthThrottlerGuard } from './auth-throttler.guard.js';

describe('AuthThrottlerGuard (Brute-Force & Credential Stuffing Protection)', () => {
  let guard: AuthThrottlerGuard;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'AUTH_RATE_LIMIT_TTL_SECONDS') return 60;
        if (key === 'AUTH_RATE_LIMIT_MAX') return 3; // Limit to 3 for testing
        return undefined;
      }),
    };

    guard = new AuthThrottlerGuard(mockConfigService as ConfigService);
  });

  function createMockContext(ip = '192.168.1.50') {
    const headers: Record<string, string> = {};
    const req = {
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

  it('allows requests within the configured rate limit', () => {
    const { context } = createMockContext('10.0.0.1');

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws 429 Too Many Requests when the limit is exceeded and sets Retry-After', () => {
    const { context, headers } = createMockContext('10.0.0.2');

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
      expect(err.getResponse().message).toContain('Too many authentication attempts');
    }
  });

  it('isolates rate limits per client IP address', () => {
    const ctxA = createMockContext('10.0.0.10');
    const ctxB = createMockContext('10.0.0.20');

    expect(guard.canActivate(ctxA.context)).toBe(true);
    expect(guard.canActivate(ctxA.context)).toBe(true);
    expect(guard.canActivate(ctxA.context)).toBe(true);

    // IP A is at limit
    expect(() => guard.canActivate(ctxA.context)).toThrow();

    // IP B is unaffected
    expect(guard.canActivate(ctxB.context)).toBe(true);
  });
});
