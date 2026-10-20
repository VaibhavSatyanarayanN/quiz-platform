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
 * In-memory rate limiting guard for AI generation endpoints.
 *
 * NOTE: This is an in-memory implementation intended for single-replica deployments
 * or per-instance rate limiting. Rate counters are not shared across distributed replicas.
 * If distributed cluster scaling is required, a Redis-backed throttler can be introduced.
 */
@Injectable()
export class AiThrottlerGuard implements CanActivate {
  private readonly logger = new Logger(AiThrottlerGuard.name);
  private readonly storage = new Map<string, ThrottleRecord>();
  private readonly ttlMs: number;
  private readonly limit: number;
  private lastCleanup = Date.now();

  constructor(private readonly configService: ConfigService) {
    const ttlSeconds = Number(
      this.configService.get<string | number>('AI_RATE_LIMIT_TTL_SECONDS') ??
        this.configService.get<string | number>('AI_THROTTLE_TTL') ??
        60,
    );
    this.ttlMs = (Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : 60) * 1000;

    const limit = Number(
      this.configService.get<string | number>('AI_RATE_LIMIT_MAX') ??
        this.configService.get<string | number>('AI_THROTTLE_LIMIT') ??
        5,
    );
    this.limit = Number.isFinite(limit) && limit > 0 ? limit : 5;
  }

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const now = Date.now();
    this.cleanup(now);

    const key = this.resolveKey(request);
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
        `AI rate limit exceeded for key [${key}]. Count: ${record.count}/${this.limit}. Retry after: ${retryAfterSeconds}s`,
      );

      response.setHeader('Retry-After', String(retryAfterSeconds));

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            'Too many AI generation requests. Please wait before generating another quiz.',
          retryAfter: retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    record.count += 1;
    return true;
  }

  private resolveKey(request: Request): string {
    const user = (request as unknown as { user?: { userId?: string } }).user;
    if (user?.userId) {
      return `user:${user.userId}`;
    }

    // IP resolution: trust Express req.ip (which respects configured trust proxy settings)
    // Avoid reading arbitrary unverified X-Forwarded-For headers directly
    const clientIp = request.ip || request.socket?.remoteAddress || 'unknown';
    return `ip:${clientIp}`;
  }

  private cleanup(now: number): void {
    // Run cleanup periodically (at most once every 60 seconds or if map exceeds 1000 items)
    if (now - this.lastCleanup > 60000 || this.storage.size > 1000) {
      for (const [k, v] of this.storage.entries()) {
        if (now >= v.resetAt) {
          this.storage.delete(k);
        }
      }
      this.lastCleanup = now;
    }
  }

  /**
   * Helper method for testing to reset storage.
   */
  resetStorage(): void {
    this.storage.clear();
  }
}
