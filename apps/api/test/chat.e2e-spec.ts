import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import { AppModule } from '../src/app.module';
import { AppCacheModule } from '../src/cache.module';
import { TestCacheModule } from './test-cache.module';
import { ChatService } from '../src/modules/chat/chat.service';

interface ChatResponseBody {
  message: string;
  flightResults?: unknown;
}

/**
 * E2E happy path for POST /chat. ChatService is stubbed so tests run without
 * OPENAI_API_KEY or SERP_API_KEY. For full flow (real agent + SerpAPI), run
 * with env set and remove the overrideProvider(ChatService) block.
 */
describe('ChatController (e2e) – happy path', () => {
  let app: INestApplication;

  const mockChatResponse = {
    message: 'Here are some flight options from JFK to CDG for 2025-03-01.',
    flightResults: {
      best_flights: [],
      other_flights: [],
    },
  };

  beforeAll(async () => {
    process.env.DATABASE_TYPE = 'better-sqlite3';
    process.env.DATABASE_NAME = ':memory:';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(AppCacheModule)
      .useModule(TestCacheModule)
      .overrideProvider(ChatService)
      .useValue({
        chat: jest.fn().mockResolvedValue(mockChatResponse),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /chat', () => {
    it('returns 200 and message + flightResults when messages array is sent', () => {
      return request(app.getHttpServer() as Server)
        .post('/chat')
        .send({
          messages: [
            {
              role: 'user',
              content: 'Find me flights from JFK to Paris on March 1, 2025.',
            },
          ],
        })
        .expect(201)
        .expect((res) => {
          const body = res.body as ChatResponseBody;
          expect(body).toHaveProperty('message');
          expect(typeof body.message).toBe('string');
          expect(body.message).toBe(mockChatResponse.message);
          expect(body).toHaveProperty('flightResults');
          expect(body.flightResults).toEqual(mockChatResponse.flightResults);
        });
    });

    it('returns 200 with fallback message when body has no messages array', () => {
      return request(app.getHttpServer() as Server)
        .post('/chat')
        .send({})
        .expect(201)
        .expect((res) => {
          const body = res.body as ChatResponseBody;
          expect(body).toHaveProperty('message');
          expect(body.message).toContain('provide');
        });
    });
  });
});
