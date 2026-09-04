import { config } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';

config({
  path: resolve(process.cwd(), '.env'),
});

function getEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export default new DataSource({
  type: 'postgres',

  host: getEnv('DB_HOST'),
  port: Number(getEnv('DB_PORT')),

  username: getEnv('DB_USERNAME'),
  password: getEnv('DB_PASSWORD'),
  database: getEnv('DB_DATABASE'),

  entities: ['src/**/*.entity.ts'],

  migrations: ['src/infrastructure/database/migrations/*.ts'],

  synchronize: false,
});