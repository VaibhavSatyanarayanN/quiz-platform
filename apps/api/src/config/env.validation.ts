export interface EnvironmentVariables {
  NODE_ENV: string;
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
  JWT_ACCESS_SECRET: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  AI_SERVICE_URL: string;
  CORS_ORIGIN?: string;
  AUTH_RATE_LIMIT_TTL_SECONDS?: number;
  AUTH_RATE_LIMIT_MAX?: number;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const errors: string[] = [];

  const requiredStrings = [
    'DB_HOST',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_DATABASE',
    'JWT_ACCESS_SECRET',
    'REDIS_HOST',
  ];

  for (const key of requiredStrings) {
    const val = config[key];
    if (typeof val !== 'string' || val.trim().length === 0) {
      errors.push(`Missing or empty required environment variable: ${key}`);
    }
  }

  const dbPort = Number(config['DB_PORT'] ?? 5432);
  if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) {
    errors.push(
      `DB_PORT must be a valid port number between 1 and 65535, received: ${config['DB_PORT']}`,
    );
  }

  const redisPort = Number(config['REDIS_PORT'] ?? 6379);
  if (!Number.isInteger(redisPort) || redisPort < 1 || redisPort > 65535) {
    errors.push(
      `REDIS_PORT must be a valid port number between 1 and 65535, received: ${config['REDIS_PORT']}`,
    );
  }

  const appPort = Number(config['PORT'] ?? 3000);
  if (!Number.isInteger(appPort) || appPort < 1 || appPort > 65535) {
    errors.push(
      `PORT must be a valid port number between 1 and 65535, received: ${config['PORT']}`,
    );
  }

  const jwtSecret = String(config['JWT_ACCESS_SECRET'] ?? '');
  if (jwtSecret.length > 0 && jwtSecret.length < 16) {
    errors.push(`JWT_ACCESS_SECRET must be at least 16 characters long for security`);
  }

  if (errors.length > 0) {
    throw new Error(
      `\n=======================================================\n` +
      `[Startup Configuration Error] Invalid Environment Setup:\n` +
      errors.map((e) => `  - ${e}`).join('\n') +
      `\n=======================================================\n`,
    );
  }

  return {
    NODE_ENV: String(config['NODE_ENV'] ?? 'development'),
    PORT: appPort,
    DB_HOST: String(config['DB_HOST']),
    DB_PORT: dbPort,
    DB_USERNAME: String(config['DB_USERNAME']),
    DB_PASSWORD: String(config['DB_PASSWORD']),
    DB_DATABASE: String(config['DB_DATABASE']),
    JWT_ACCESS_SECRET: jwtSecret,
    REDIS_HOST: String(config['REDIS_HOST']),
    REDIS_PORT: redisPort,
    AI_SERVICE_URL: String(config['AI_SERVICE_URL'] ?? 'http://127.0.0.1:8000'),
    CORS_ORIGIN: config['CORS_ORIGIN'] ? String(config['CORS_ORIGIN']) : undefined,
    AUTH_RATE_LIMIT_TTL_SECONDS: config['AUTH_RATE_LIMIT_TTL_SECONDS']
      ? Number(config['AUTH_RATE_LIMIT_TTL_SECONDS'])
      : 60,
    AUTH_RATE_LIMIT_MAX: config['AUTH_RATE_LIMIT_MAX']
      ? Number(config['AUTH_RATE_LIMIT_MAX'])
      : 10,
  };
}
