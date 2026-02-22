import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import { AppModule } from '../src/app.module';
import { AppCacheModule } from '../src/cache.module';
import { TestCacheModule } from './test-cache.module';

interface PriceHistoryResponse {
  records: unknown[];
  message?: string;
}

describe('AppController + PriceHistory (e2e) – happy path', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DATABASE_TYPE = 'better-sqlite3';
    process.env.DATABASE_NAME = ':memory:';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(AppCacheModule)
      .useModule(TestCacheModule)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health-check', () => {
    it('returns 200 and OK', () => {
      return request(app.getHttpServer() as Server)
        .get('/health-check')
        .expect(200)
        .expect((res) => {
          expect(res.text).toBe('OK');
        });
    });
  });

  describe('GET /price-history', () => {
    it('returns 200 and records array when departure and arrival are provided', () => {
      return request(app.getHttpServer() as Server)
        .get('/price-history')
        .query({ departure: 'JFK', arrival: 'CDG' })
        .expect(200)
        .expect((res) => {
          const body = res.body as PriceHistoryResponse;
          expect(body).toHaveProperty('records');
          expect(Array.isArray(body.records)).toBe(true);
        });
    });

    it('returns 200 and empty records when params are missing (graceful handling)', () => {
      return request(app.getHttpServer() as Server)
        .get('/price-history')
        .expect(200)
        .expect((res) => {
          const body = res.body as PriceHistoryResponse;
          expect(body).toHaveProperty('records');
          expect(Array.isArray(body.records)).toBe(true);
        });
    });
  });
});
