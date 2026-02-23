import { createHash } from 'node:crypto';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseResponse, EngineParameters, getJson } from 'serpapi';
import { SerpGoogleFlightResponseDto } from './dto/serp-google-flight-response.dto';

/**
 * Generic normalizer for cache key payloads: omit null/undefined, coerce numbers, stringify the rest.
 * Returns a plain object with sorted keys for stable serialization.
 */
function normalizeForCache(
  obj: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'object' && v !== null) {
      out[k] = JSON.stringify(v);
    } else if (typeof v === 'number' && !Number.isNaN(v)) {
      out[k] = v;
    } else if (
      typeof v === 'string' &&
      v.trim() !== '' &&
      !Number.isNaN(Number(v))
    ) {
      out[k] = Number(v);
    } else if (typeof v === 'boolean' || v === 'true' || v === 'false') {
      out[k] = Boolean(v);
    } else {
      out[k] = String(v as any);
    }
  }
  return out;
}

function cacheKeyFromObject(obj: Record<string, unknown>): string {
  const normalized = normalizeForCache(obj);
  const sorted = Object.keys(normalized)
    .sort()
    .reduce<Record<string, string | number | boolean>>((acc, k) => {
      acc[k] = normalized[k];
      return acc;
    }, {});
  return createHash('md5').update(JSON.stringify(sorted)).digest('hex');
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
    const response: SerpGoogleFlightResponseDto = await getJson({
      engine: 'google_flights',
      ...parameters,
      api_key: this.apiKey,
    });
    const best = response?.best_flights?.length ?? 0;
    const other = response?.other_flights?.length ?? 0;
    this.logger.debug(
      `_searchFlight result: ${best} best_flights, ${other} other_flights`,
    );
    return response;
  }

  private normalizeType(value: unknown): 1 | 2 {
    if (value === undefined) return 2;
    if (typeof value === 'string') return Number(value) === 1 ? 1 : 2;
    if (value === 1) return 1;
    return 2;
  }

  async searchFlight(
    parameters: EngineParameters & Record<string, unknown>,
  ): Promise<BaseResponse> {
    const cacheKey = cacheKeyFromObject(
      parameters as unknown as Record<string, unknown>,
    );
    this.logger.debug(
      `searchFlight params: ${parameters.departure_id} → ${parameters.arrival_id} ${parameters.outbound_date}`,
    );
    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) {
      this.logger.debug('searchFlight cache hit');
      return cachedData as BaseResponse;
    }
    this.logger.debug('searchFlight cache miss, calling API');
    const data = await this._searchFlight(parameters);
    await this.cacheManager.set(cacheKey, data);
    this.logger.debug('searchFlight result cached');
    return data;
  }

  /**
   * Fetch return-flight options for a round trip after the user has selected an outbound flight.
   * Uses the departure_token from the selected outbound option. Does not use cache.
   */
  async getReturnOptions(
    departureToken: string,
    returnDate?: string,
  ): Promise<BaseResponse> {
    this.logger.debug(
      `getReturnOptions departure_token=${departureToken.slice(0, 20)}..., return_date=${returnDate ?? 'any'}`,
    );
    const params: Record<string, string> = {
      engine: 'google_flights',
      departure_token: departureToken,
      api_key: this.apiKey,
    };
    if (returnDate) params.return_date = returnDate;
    const response: SerpGoogleFlightResponseDto = await getJson(params);
    const best = response?.best_flights?.length ?? 0;
    const other = response?.other_flights?.length ?? 0;
    this.logger.debug(
      `getReturnOptions result: ${best} best_flights, ${other} other_flights`,
    );
    return response;
  }
}
