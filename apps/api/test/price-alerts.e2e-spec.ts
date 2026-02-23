import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import { AppModule } from '../src/app.module';
import { AppCacheModule } from '../src/cache.module';
import { TestCacheModule } from './test-cache.module';

describe('PriceAlertsController (e2e)', () => {
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

  const validBody = {
    departureId: 'JFK',
    arrivalId: 'CDG',
    outboundDate: '2026-06-01',
    targetPrice: 299.99,
    email: 'alerts@example.com',
  };

  describe('POST /price-alerts', () => {
    it('returns 201 and created alert shape when body is valid', () => {
      return request(app.getHttpServer() as Server)
        .post('/price-alerts')
        .send(validBody)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('departureId', 'JFK');
          expect(res.body).toHaveProperty('arrivalId', 'CDG');
          expect(res.body).toHaveProperty('outboundDate', '2026-06-01');
          expect(res.body).toHaveProperty('targetPrice', 299.99);
          expect(res.body).toHaveProperty('email', 'alerts@example.com');
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('createdAt');
        });
    });

    it('returns 400 when email is missing', () => {
      const { email: _e, ...noEmail } = validBody;
      return request(app.getHttpServer() as Server)
        .post('/price-alerts')
        .send(noEmail)
        .expect(400);
    });

    it('returns 400 when targetPrice is negative', () => {
      return request(app.getHttpServer() as Server)
        .post('/price-alerts')
        .send({ ...validBody, targetPrice: -10 })
        .expect(400);
    });

    it('returns 400 when outboundDate is not YYYY-MM-DD', () => {
      return request(app.getHttpServer() as Server)
        .post('/price-alerts')
        .send({ ...validBody, outboundDate: '06/01/2026' })
        .expect(400);
    });
  });
});
