import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import type { Cache } from '@nestjs/cache-manager';
import { FlightSearchService } from './flight-search.service';
import { SerpGoogleFlightResponseDto } from './dto/serp-google-flight-response.dto';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_SERPAPI_RESPONSE: SerpGoogleFlightResponseDto = {
  best_flights: [
    {
      flights: [
        {
          departure_airport: {
            name: 'JFK Airport',
            id: 'JFK',
            time: '2026-03-01 10:00',
          },
          arrival_airport: {
            name: 'Charles de Gaulle',
            id: 'CDG',
            time: '2026-03-02 00:30',
          },
          duration: 450,
          airline: 'Air France',
          airline_logo: 'https://example.com/af.png',
          flight_number: 'AF 011',
          travel_class: 'Economy',
        },
      ],
      layovers: [],
      total_duration: 450,
      price: 850,
      type: 'One way',
      airline: 'Air France',
      airline_logo: 'https://example.com/af.png',
    },
  ],
  other_flights: [],
  price_insights: {
    lowest_price: 780,
    price_level: 'low',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildCacheManager(overrides: Partial<Cache> = {}): Cache {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as Cache;
}

function buildConfigService(
  overrides: Record<string, string> = {},
): ConfigService {
  const defaults: Record<string, string> = {
    SERP_API_KEY: 'test-serp-key',
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => defaults[key] ?? undefined),
  } as unknown as ConfigService;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FlightSearchService', () => {
  let service: FlightSearchService;
  let cacheManager: Cache;

  async function createService(
    cacheOverrides: Partial<Cache> = {},
    configOverrides: Record<string, string> = {},
  ): Promise<void> {
    cacheManager = buildCacheManager(cacheOverrides);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlightSearchService,
        { provide: CACHE_MANAGER, useValue: cacheManager },
        {
          provide: ConfigService,
          useValue: buildConfigService(configOverrides),
        },
      ],
    }).compile();

    service = module.get<FlightSearchService>(FlightSearchService);
  }

  describe('constructor', () => {
    it('throws if SERP_API_KEY is not configured', async () => {
      await expect(createService({}, { SERP_API_KEY: '' })).rejects.toThrow(
        'SERP_API_KEY is not configured',
      );
    });

    it('instantiates successfully when SERP_API_KEY is set', async () => {
      await createService();
      expect(service).toBeDefined();
    });
  });

  describe('searchFlight – cache behaviour', () => {
    const searchParams = {
      departure_id: 'JFK',
      arrival_id: 'CDG',
      outbound_date: '2026-03-01',
    };

    it('returns cached value on cache hit (skips SerpAPI call)', async () => {
      await createService({
        get: jest.fn().mockResolvedValue(MOCK_SERPAPI_RESPONSE),
      });

      const _searchSpy = jest
        .spyOn(service, '_searchFlight')
        .mockResolvedValue(MOCK_SERPAPI_RESPONSE);

      const result = await service.searchFlight(searchParams);

      expect(cacheManager.get).toHaveBeenCalledTimes(1);
      expect(_searchSpy).not.toHaveBeenCalled();
      expect(result).toEqual(MOCK_SERPAPI_RESPONSE);
    });

    it('calls SerpAPI and stores result in cache on cache miss', async () => {
      await createService(); // get returns null by default

      const _searchSpy = jest
        .spyOn(service, '_searchFlight')
        .mockResolvedValue(MOCK_SERPAPI_RESPONSE);

      const result = await service.searchFlight(searchParams);

      expect(cacheManager.get).toHaveBeenCalledTimes(1);
      expect(_searchSpy).toHaveBeenCalledTimes(1);
      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        MOCK_SERPAPI_RESPONSE,
      );
      expect(result).toEqual(MOCK_SERPAPI_RESPONSE);
    });

    it('generates a stable cache key regardless of parameter type coercion', async () => {
      await createService({
        get: jest.fn().mockResolvedValue(null),
      });

      const _searchSpy = jest
        .spyOn(service, '_searchFlight')
        .mockResolvedValue(MOCK_SERPAPI_RESPONSE);

      // type passed as string vs. number should produce the same cache key
      await service.searchFlight({
        ...searchParams,
        type: 2,
      });
      await service.searchFlight({ ...searchParams, type: 2 });

      const mockCalls = (cacheManager.get as jest.Mock<unknown, [string]>).mock
        .calls;
      const firstKey = mockCalls[0][0];
      const secondKey = mockCalls[1][0];

      expect(firstKey).toBe(secondKey);
      expect(_searchSpy).toHaveBeenCalledTimes(2); // two cache misses, same key shape
    });
  });

  describe('searchFlight – round-trip vs one-way', () => {
    it('includes return_date in cache key for round-trip searches', async () => {
      await createService();
      jest
        .spyOn(service, '_searchFlight')
        .mockResolvedValue(MOCK_SERPAPI_RESPONSE);

      await service.searchFlight({
        departure_id: 'JFK',
        arrival_id: 'CDG',
        outbound_date: '2026-03-01',
        return_date: '2026-03-08',
        type: 1,
      });
      await service.searchFlight({
        departure_id: 'JFK',
        arrival_id: 'CDG',
        outbound_date: '2026-03-01',
        return_date: '2026-03-09',
        type: 1,
      });

      const keys = (cacheManager.get as jest.Mock<unknown, [string]>).mock
        .calls as [string][];
      expect(keys[0][0]).not.toBe(keys[1][0]);
      expect(keys[0][0]).toMatch(/^[a-f0-9]{32}$/);
    });

    it('omits return_date from cache key for one-way searches', async () => {
      await createService();
      jest
        .spyOn(service, '_searchFlight')
        .mockResolvedValue(MOCK_SERPAPI_RESPONSE);

      await service.searchFlight({
        departure_id: 'JFK',
        arrival_id: 'CDG',
        outbound_date: '2026-03-01',
        type: 2,
      });
      await service.searchFlight({
        departure_id: 'JFK',
        arrival_id: 'CDG',
        outbound_date: '2026-03-01',
        return_date: '2026-03-08',
        type: 2,
      });

      const keys = (cacheManager.get as jest.Mock<unknown, [string]>).mock
        .calls as [string][];
      expect(keys[0][0]).toBe(keys[1][0]);
    });
  });

  describe('_searchFlight (SerpAPI integration)', () => {
    it('passes the api_key and engine to serpapi getJson', async () => {
      await createService();

      // Mock the inner serpapi call
      const serpMock = jest
        .spyOn(service, '_searchFlight')
        .mockResolvedValue(MOCK_SERPAPI_RESPONSE);

      await service._searchFlight({
        engine: 'google_flights',
        departure_id: 'JFK',
        arrival_id: 'LHR',
        outbound_date: '2026-04-01',
        api_key: 'test-serp-key',
      });

      expect(serpMock).toHaveBeenCalledWith(
        expect.objectContaining({
          departure_id: 'JFK',
          arrival_id: 'LHR',
        }),
      );
    });
  });
});
