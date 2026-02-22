import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseResponse, EngineParameters, getJson } from 'serpapi';

/** Normalized search params for stable cache keys. */
interface NormalizedSearchParams {
  departure_id: string;
  arrival_id: string;
  outbound_date: string;
  return_date: string | undefined;
  type: 1 | 2;
}

@Injectable()
export class FlightSearchService {
  private readonly logger = new Logger(FlightSearchService.name);
  private apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    const serpKey = this.configService.get<string>('SERP_API_KEY');
    if (!serpKey) {
      throw new Error(
        'SERP_API_KEY is not configured. Add it to .env to enable Google Flights search (see https://serpapi.com).',
      );
    }
    this.apiKey = serpKey;
  }

  async _searchFlight(parameters: EngineParameters): Promise<BaseResponse> {
    this.logger.debug(
      `_searchFlight calling SerpAPI: ${JSON.stringify({ ...parameters, api_key: '[redacted]' })}`,
    );
    const response = await getJson({
      engine: 'google_flights',
      ...parameters,
      api_key: this.apiKey,
    });
    const best = Array.isArray(response?.best_flights)
      ? response.best_flights.length
      : 0;
    const other = Array.isArray(response?.other_flights)
      ? response.other_flights.length
      : 0;
    this.logger.debug(
      `_searchFlight result: ${best} best_flights, ${other} other_flights`,
    );
    return response;
  }

  /** Normalize params so cache key is stable across controller (string query) vs chat (number type). */
  private normalizeParams(
    parameters: EngineParameters,
  ): NormalizedSearchParams {
    const type = this.normalizeType(parameters.type);
    return {
      departure_id: String(parameters.departure_id ?? ''),
      arrival_id: String(parameters.arrival_id ?? ''),
      outbound_date: String(parameters.outbound_date ?? ''),
      return_date: parameters.return_date
        ? String(parameters.return_date)
        : undefined,
      type,
    };
  }

  private normalizeType(value: unknown): 1 | 2 {
    if (value === undefined) return 2;
    if (typeof value === 'string') return Number(value) === 1 ? 1 : 2;
    if (value === 1) return 1;
    return 2;
  }

  async searchFlight(parameters: EngineParameters): Promise<BaseResponse> {
    const normalized = this.normalizeParams(parameters);
    const cacheKey = JSON.stringify({
      departure_id: normalized.departure_id,
      arrival_id: normalized.arrival_id,
      outbound_date: normalized.outbound_date,
      return_date: normalized.return_date,
      type: normalized.type,
    });
    this.logger.debug(
      `searchFlight params: ${normalized.departure_id} → ${normalized.arrival_id} ${normalized.outbound_date}`,
    );
    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) {
      this.logger.debug('searchFlight cache hit');
      return cachedData as BaseResponse;
    }
    this.logger.debug('searchFlight cache miss, calling API');
    const data = await this._searchFlight(
      normalized as unknown as EngineParameters,
    );
    await this.cacheManager.set(cacheKey, data);
    this.logger.debug('searchFlight result cached');
    return data;
  }
}
