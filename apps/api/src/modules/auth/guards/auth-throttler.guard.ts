import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

interface ThrottleRecord {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate limiting guard for authentication endpoints (login, registration).
 * Protects against credential stuffing and brute-force attacks.
 */
@Injectable()
export class AuthThrottlerGuard implements CanActivate {
  private readonly logger = new Logger(AuthThrottlerGuard.name);
  private readonly storage = new Map<string, ThrottleRecord>();
  private readonly ttlMs: number;
  private readonly limit: number;
  private lastCleanup = Date.now();

  constructor(private readonly configService: ConfigService) {
    const ttlSeconds = Number(
      this.configService.get<string | number>('AUTH_RATE_LIMIT_TTL_SECONDS') ?? 60,
    );
    this.ttlMs = (Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : 60) * 1000;

    const limit = Number(
      this.configService.get<string | number>('AUTH_RATE_LIMIT_MAX') ?? 10,
    );
    this.limit = Number.isFinite(limit) && limit > 0 ? limit : 10;
  }

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const now = Date.now();
    this.cleanup(now);

    const clientIp = request.ip || request.socket?.remoteAddress || 'unknown';
    const key = `auth:${clientIp}`;
    let record = this.storage.get(key);

    if (!record || now >= record.resetAt) {
      record = {
        count: 1,
        resetAt: now + this.ttlMs,
      };
      this.storage.set(key, record);
      return true;
    }

    if (record.count >= this.limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((record.resetAt - now) / 1000),
      );

      this.logger.warn(
        `Auth rate limit exceeded for IP [${clientIp}]. Count: ${record.count}/${this.limit}. Retry after: ${retryAfterSeconds}s`,
      );

      response.setHeader('Retry-After', String(retryAfterSeconds));

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            'Too many authentication attempts. Please wait before trying again.',
          retryAfter: retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    record.count += 1;
    return true;
  }

  private cleanup(now: number): void {
    if (now - this.lastCleanup > 60000 || this.storage.size > 1000) {
      for (const [k, v] of this.storage.entries()) {
        if (now >= v.resetAt) {
          this.storage.delete(k);
        }
      }
      this.lastCleanup = now;
    }
  }

  resetStorage(): void {
    this.storage.clear();
  }
}
