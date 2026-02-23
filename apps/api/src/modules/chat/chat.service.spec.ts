/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChatService, type ChatMessage } from './chat.service';
import { FlightSearchService } from '../flight-search/flight-search.service';
import { PriceHistoryService } from '../price-history/price-history.service';

interface ExecutorInvokeArgs {
  input: string;
  chat_history: unknown[];
}

// ─── Mock LangChain agent and executor (no real OpenAI or agent execution) ───

const executorInvokeMock = jest.fn().mockResolvedValue({
  output: 'Here are your flight options.',
});

jest.mock('langchain/agents', () => ({
  createToolCallingAgent: jest.fn(() => ({})),
  AgentExecutor: jest.fn().mockImplementation(() => ({
    invoke: executorInvokeMock,
  })),
}));

// ChatOpenAI is still constructed but never used for network calls when executor is mocked
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: '' }),
  })),
}));

describe('ChatService', () => {
  let service: ChatService;
  let flightSearchService: jest.Mocked<FlightSearchService>;

  beforeEach(async () => {
    executorInvokeMock.mockClear();
    executorInvokeMock.mockResolvedValue({
      output: 'Here are your flight options.',
    });

    const mockFlightSearchService = {
      searchFlight: jest.fn().mockResolvedValue({
        best_flights: [],
        other_flights: [],
        price_insights: { lowest_price: 400, price_level: 'low' },
      }),
    };
    const mockPriceHistoryService = {
      saveSearch: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'OPENAI_API_KEY' ? 'test-openai-key' : undefined,
            ),
          },
        },
        { provide: FlightSearchService, useValue: mockFlightSearchService },
        { provide: PriceHistoryService, useValue: mockPriceHistoryService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    flightSearchService = module.get(FlightSearchService);
  });

  describe('constructor', () => {
    it('throws if OPENAI_API_KEY is not configured', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            ChatService,
            {
              provide: ConfigService,
              useValue: { get: jest.fn(() => undefined) },
            },
            { provide: FlightSearchService, useValue: {} },
            { provide: PriceHistoryService, useValue: {} },
          ],
        }).compile(),
      ).rejects.toThrow('OPENAI_API_KEY is not configured');
    });

    it('instantiates when OPENAI_API_KEY is set', () => {
      expect(service).toBeDefined();
    });
  });

  describe('chat – executor invocation (tool-calling integration)', () => {
    it('invokes the agent executor with the user message as input and empty chat_history when no history', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Find flights from JFK to LHR' },
      ];

      await service.chat(messages);

      expect(executorInvokeMock).toHaveBeenCalledTimes(1);
      const [args] = executorInvokeMock.mock.calls[0] as [ExecutorInvokeArgs];
      expect(args).toHaveProperty('input', 'Find flights from JFK to LHR');
      expect(args).toHaveProperty('chat_history');
      expect(Array.isArray(args.chat_history)).toBe(true);
      expect(args.chat_history).toHaveLength(0);
    });

    it('invokes the executor with correct params so the agent can call search_flights', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Find flights from JFK to LHR' },
      ];

      const result = await service.chat(messages);

      expect(executorInvokeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'Find flights from JFK to LHR',
          chat_history: [],
        }),
      );
      expect(result.message).toBe('Here are your flight options.');
      expect(result.flightResults).toBeNull(); // executor was mocked, so tool was not run
    });
  });

  describe('chat – conversation state', () => {
    it('appends new user message and passes existing conversation as chat_history', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Flights from BOS to MIA on April 1' },
        { role: 'assistant', content: 'Found several options. From $320.' },
        { role: 'user', content: 'What is the cheapest option?' },
      ];

      await service.chat(messages);

      expect(executorInvokeMock).toHaveBeenCalledTimes(1);
      const [args] = executorInvokeMock.mock.calls[0] as [ExecutorInvokeArgs];
      expect(args.input).toBe('What is the cheapest option?');
      expect(Array.isArray(args.chat_history)).toBe(true);
      // chat_history should contain the previous turn (1 human + 1 assistant)
      expect(args.chat_history.length).toBe(2);
      const first = args.chat_history[0];
      const second = args.chat_history[1];
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      if (first && typeof first === 'object' && 'content' in first) {
        expect(String((first as { content: string }).content)).toBe(
          'Flights from BOS to MIA on April 1',
        );
      }
      if (second && typeof second === 'object' && 'content' in second) {
        expect(String((second as { content: string }).content)).toBe(
          'Found several options. From $320.',
        );
      }
    });

    it('extracts only the latest user message as input and puts the rest in chat_history', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Flights from LAX to SFO next Friday' },
        { role: 'assistant', content: 'Found 8 flights. From $120.' },
        { role: 'user', content: 'Only show nonstop options' },
      ];

      await service.chat(messages);

      const [args] = executorInvokeMock.mock.calls[0] as [ExecutorInvokeArgs];
      expect(args.input).toBe('Only show nonstop options');
      expect(args.chat_history).toHaveLength(2);
    });
  });

  describe('chat – response shape', () => {
    it('returns message and flightResults (null when executor does not run tool)', async () => {
      const result = await service.chat([{ role: 'user', content: 'Hello' }]);

      expect(result).toHaveProperty('message');
      expect(result.message).toBeDefined();
      expect(result.flightResults).toBeNull();
      expect(flightSearchService.searchFlight).not.toHaveBeenCalled();
    });

    it('returns message from executor output', async () => {
      executorInvokeMock.mockResolvedValueOnce({
        output: 'Found 5 flights from CDG to JFK. Prices start at $420.',
      });

      const result = await service.chat([
        { role: 'user', content: 'Paris to New York in May' },
      ]);

      expect(result.message).toBe(
        'Found 5 flights from CDG to JFK. Prices start at $420.',
      );
    });
  });
});
