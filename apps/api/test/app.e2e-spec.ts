import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import net from 'node:net';
import { AppModule } from './../src/app.module.js';

function checkPortOpen(host: string, port: number, timeoutMs = 1200): Promise<boolean> {
  return new Promise((res) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.destroy();
      res(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      res(false);
    });
    socket.once('error', () => {
      socket.destroy();
      res(false);
    });
    socket.connect(port, host);
  });
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let isDbAvailable = false;

  beforeEach(async () => {
    isDbAvailable = await checkPortOpen('localhost', 5432);
    if (!isDbAvailable) {
      return;
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', async () => {
    if (!isDbAvailable || !app) {
      return;
    }

    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});
