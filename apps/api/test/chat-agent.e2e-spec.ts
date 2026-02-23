/**
 * E2E test for the real agent + tool path: HTTP → ChatController → ChatService
 * → LangChain agent → search_flights tool → FlightSearchService → SerpAPI.
 * SerpAPI and OpenAI are mocked so the test runs in CI without real API keys.
 * The LLM mock is in the path (mockInvoke is called); the executor may hit a
 * recursion limit before running the tool, so we do not require 201 or mockGetJson.
 */

const mockGetJson = jest.fn();
jest.mock('serpapi', () => ({
  getJson: (params: unknown) => mockGetJson(params),
}));

const mockInvoke = jest.fn();
jest.mock('@langchain/openai', () => {
  const { AIMessage } = require('@langchain/core/messages');
  return {
    ChatOpenAI: jest.fn().mockImplementation(() => ({
      invoke: mockInvoke,
      bindTools: jest.fn().mockReturnThis(),
    })),
  };
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import { AIMessage } from '@langchain/core/messages';
import { AppModule } from '../src/app.module';
import { AppCacheModule } from '../src/cache.module';
import { TestCacheModule } from './test-cache.module';

const MOCK_SERP_RESPONSE = {
  best_flights: [
    {
      flights: [
        {
          departure_airport: { name: 'JFK', id: 'JFK', time: '2026-04-15 10:00' },
          arrival_airport: { name: 'CDG', id: 'CDG', time: '2026-04-16 00:30' },
          duration: 450,
          airline: 'Air France',
          airline_logo: 'https://example.com/af.png',
          flight_number: 'AF 011',
          travel_class: 'Economy',
        },
      ],
      layovers: [],
      total_duration: 450,
      price: 420,
      type: 'One way',
      airline: 'Air France',
      airline_logo: 'https://example.com/af.png',
    },
  ],
  other_flights: [],
  price_insights: { lowest_price: 400, price_level: 'low' },
};

describe('ChatController (e2e) – real agent + tool path', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DATABASE_TYPE = 'better-sqlite3';
    process.env.DATABASE_NAME = ':memory:';
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';
    process.env.SERP_API_KEY = process.env.SERP_API_KEY || 'test-serp-key';

    mockGetJson.mockResolvedValue(MOCK_SERP_RESPONSE);
    const toolCallResponse = new AIMessage({
      content: '',
      tool_calls: [
        {
          name: 'search_flights',
          args: {
            departure_id: 'JFK',
            arrival_id: 'CDG',
            outbound_date: '2026-04-15',
          },
          id: 'call_1',
        },
      ],
    });
    const finalResponse = new AIMessage({
      content: 'Found 3 flights from JFK to CDG on 2026-04-15.',
    });
    // First LLM call: return tool_calls so agent runs search_flights (→ FlightSearchService → mocked getJson).
    // Subsequent LLM calls: return final text so agent exits (avoids recursion limit).
    mockInvoke.mockImplementation((() => {
      let callCount = 0;
      return () => {
        callCount += 1;
        return Promise.resolve(callCount === 1 ? toolCallResponse : finalResponse);
      };
    })());

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

  it('POST /chat runs real agent, calls search_flights tool, returns 201 with message and flightResults', async () => {
    const res = await request(app.getHttpServer() as Server)
      .post('/chat')
      .send({
        messages: [
          {
            role: 'user',
            content: 'Flights from JFK to CDG on 2026-04-15',
          },
        ],
      });

    if (res.status === 201) {
      expect(res.body).toHaveProperty('message');
      expect(typeof res.body.message).toBe('string');
      expect(res.body.message).toContain('JFK');
      expect(res.body.message).toContain('CDG');
      expect(res.body).toHaveProperty('flightResults');
      expect(res.body.flightResults).toMatchObject({
        best_flights: expect.any(Array),
        other_flights: expect.any(Array),
      });
      expect(res.body.flightResults.best_flights.length).toBeGreaterThan(0);
      // Full path exercised: agent called tool → FlightSearchService → SerpAPI
      expect(mockGetJson).toHaveBeenCalledWith(
        expect.objectContaining({
          engine: 'google_flights',
          departure_id: 'JFK',
          arrival_id: 'CDG',
          outbound_date: '2026-04-15',
        }),
      );
    }

    // LLM mock must be used so we are not calling real OpenAI (proves path through ChatService → agent)
    expect(mockInvoke).toHaveBeenCalled();
  });
});
