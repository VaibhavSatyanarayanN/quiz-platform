import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.validation.js';

describe('Environment Configuration Validation (Startup Guard)', () => {
  const validConfig = {
    NODE_ENV: 'development',
    PORT: '3000',
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    DB_USERNAME: 'quiz_user',
    DB_PASSWORD: 'quiz_password',
    DB_DATABASE: 'quiz_platform',
    JWT_ACCESS_SECRET: 'super_secret_jwt_key_at_least_16_chars',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    AI_SERVICE_URL: 'http://127.0.0.1:8000',
  };

  it('passes and returns structured config with valid environment variables', () => {
    const validated = validateEnv(validConfig);
    expect(validated.PORT).toBe(3000);
    expect(validated.DB_PORT).toBe(5432);
    expect(validated.REDIS_PORT).toBe(6379);
    expect(validated.DB_HOST).toBe('localhost');
    expect(validated.JWT_ACCESS_SECRET).toBe('super_secret_jwt_key_at_least_16_chars');
  });

  it('fails with clear error when required DB variables are missing', () => {
    const invalidConfig = { ...validConfig, DB_HOST: '' };
    expect(() => validateEnv(invalidConfig)).toThrow(
      'Missing or empty required environment variable: DB_HOST',
    );
  });

  it('fails with clear error when JWT_ACCESS_SECRET is too short (< 16 characters)', () => {
    const invalidConfig = { ...validConfig, JWT_ACCESS_SECRET: 'short' };
    expect(() => validateEnv(invalidConfig)).toThrow(
      'JWT_ACCESS_SECRET must be at least 16 characters long for security',
    );
  });

  it('fails with clear error when port is invalid', () => {
    const invalidConfig = { ...validConfig, DB_PORT: 'not-a-port' };
    expect(() => validateEnv(invalidConfig)).toThrow(
      'DB_PORT must be a valid port number between 1 and 65535',
    );
  });

  it('fails when REDIS_HOST is missing', () => {
    const invalidConfig = { ...validConfig, REDIS_HOST: '   ' };
    expect(() => validateEnv(invalidConfig)).toThrow(
      'Missing or empty required environment variable: REDIS_HOST',
    );
  });
});
