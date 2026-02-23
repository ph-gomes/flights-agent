/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceHistoryService } from './price-history.service';
import { FlightSearchRecord } from './entities/flight-search-record.entity';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_SERPAPI_RESULT = {
  best_flights: [
    {
      flights: [],
      price: 420,
      total_duration: 360,
    },
  ],
  other_flights: [],
  price_insights: { lowest_price: 420, price_level: 'low' },
};

function buildMockRepository() {
  const created: FlightSearchRecord[] = [];
  return {
    create: jest.fn((dto: Partial<FlightSearchRecord>) => {
      const record = {
        id: 'test-uuid-1',
        ...dto,
        createdAt: new Date(),
      } as FlightSearchRecord;
      created.push(record);
      return record;
    }),
    save: jest.fn((entity: FlightSearchRecord) => Promise.resolve(entity)),
    find: jest.fn().mockResolvedValue([]),
  };
}

describe('PriceHistoryService', () => {
  let service: PriceHistoryService;
  let recordRepo: jest.Mocked<Repository<FlightSearchRecord>>;

  beforeEach(async () => {
    const mockRepo = buildMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceHistoryService,
        {
          provide: getRepositoryToken(FlightSearchRecord),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<PriceHistoryService>(PriceHistoryService);
    recordRepo = module.get(getRepositoryToken(FlightSearchRecord));
  });

  describe('saveSearch', () => {
    it('calls recordRepo.create with normalized params and result payload', async () => {
      const params = {
        departure_id: 'JFK',
        arrival_id: 'CDG',
        outbound_date: '2026-04-10',
        return_date: undefined,
        type: 2,
      };

      await service.saveSearch(params, MOCK_SERPAPI_RESULT);

      expect(recordRepo.create).toHaveBeenCalledTimes(1);
      expect(recordRepo.create).toHaveBeenCalledWith({
        departureId: 'JFK',
        arrivalId: 'CDG',
        outboundDate: '2026-04-10',
        returnDate: null,
        type: 2,
        resultPayload: MOCK_SERPAPI_RESULT,
      });
    });

    it('calls recordRepo.save after create and returns the saved record', async () => {
      const params = {
        departure_id: 'LHR',
        arrival_id: 'JFK',
        outbound_date: '2026-05-01',
        return_date: '2026-05-15',
        type: 1,
      };

      const result = await service.saveSearch(params, MOCK_SERPAPI_RESULT);

      expect(recordRepo.save).toHaveBeenCalledTimes(1);
      expect(recordRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          departureId: 'LHR',
          arrivalId: 'JFK',
          outboundDate: '2026-05-01',
          returnDate: '2026-05-15',
          type: 1,
          resultPayload: MOCK_SERPAPI_RESULT,
        }),
      );
      expect(result).toBeDefined();
      expect(result.departureId).toBe('LHR');
      expect(result.arrivalId).toBe('JFK');
    });

    it('defaults type to 2 and nulls for missing optional params', async () => {
      const params = {
        departure_id: 'SFO',
        arrival_id: 'LAX',
        outbound_date: '2026-06-01',
      };

      await service.saveSearch(params, MOCK_SERPAPI_RESULT);

      expect(recordRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          departureId: 'SFO',
          arrivalId: 'LAX',
          outboundDate: '2026-06-01',
          returnDate: null,
          type: 2,
        }),
      );
    });
  });

  describe('getHistoryForRoute', () => {
    it('calls recordRepo.find with departureId and arrivalId, ordered by createdAt DESC', async () => {
      const records = [
        {
          id: 'r1',
          departureId: 'JFK',
          arrivalId: 'CDG',
          outboundDate: '2026-04-10',
          returnDate: null,
          type: 2,
          resultPayload: {},
          createdAt: new Date(),
        } as FlightSearchRecord,
      ];
      (recordRepo.find as jest.Mock).mockResolvedValueOnce(records);

      const result = await service.getHistoryForRoute('JFK', 'CDG');

      expect(recordRepo.find).toHaveBeenCalledWith({
        where: { departureId: 'JFK', arrivalId: 'CDG' },
        order: { createdAt: 'DESC' },
        take: 50,
      });
      expect(result).toEqual(records);
    });
  });

  describe('getHistoryForRouteDto', () => {
    it('returns DTOs with lowestPrice extracted from resultPayload', async () => {
      const records = [
        {
          id: 'r1',
          departureId: 'JFK',
          arrivalId: 'CDG',
          outboundDate: '2026-04-10',
          returnDate: null,
          type: 2,
          resultPayload: MOCK_SERPAPI_RESULT,
          createdAt: new Date('2026-04-01T12:00:00Z'),
        } as FlightSearchRecord,
      ];
      (recordRepo.find as jest.Mock).mockResolvedValueOnce(records);

      const result = await service.getHistoryForRouteDto('JFK', 'CDG');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'r1',
        departureId: 'JFK',
        arrivalId: 'CDG',
        outboundDate: '2026-04-10',
        returnDate: null,
        type: 2,
        createdAt: '2026-04-01T12:00:00.000Z',
        lowestPrice: 420,
      });
    });
  });
});
