import { createHash } from 'node:crypto';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseResponse, EngineParameters, getJson } from 'serpapi';
import { SerpGoogleFlightResponseDto } from './dto/serp-google-flight-response.dto';

function cacheKeyFromObject(obj: Record<string, unknown>): string {
  const sorted = Object.keys(obj)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = obj[k];
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
    try {
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
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'SerpAPI request failed';
      throw new BadGatewayException(`Flight search failed: ${message}`, {
        cause: err,
      });
    }
  }

  async searchFlight(
    parameters: EngineParameters & Record<string, unknown>,
  ): Promise<BaseResponse> {
    const token =
      typeof parameters.departure_token === 'string'
        ? parameters.departure_token.trim()
        : '';

    // Return-options: when departure_token is present, fetch return flights (no cache)
    if (token) {
      const outboundDate =
        typeof parameters.outbound_date === 'string'
          ? parameters.outbound_date.trim()
          : '';
      if (!outboundDate) {
        throw new BadRequestException(
          'outbound_date is required when using departure_token',
        );
      }
      this.logger.debug(
        `searchFlight (return-options) token length=${token.length}, outbound_date=${outboundDate}`,
      );
      const params: Record<string, string> = {
        ...parameters,
        engine: 'google_flights',
      };

      try {
        const response: SerpGoogleFlightResponseDto = await getJson(params);
        const best = response?.best_flights?.length ?? 0;
        const other = response?.other_flights?.length ?? 0;
        this.logger.debug(
          `searchFlight (return-options) result: ${best} best_flights, ${other} other_flights`,
        );
        return response;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'SerpAPI request failed';
        throw new BadGatewayException(`Flight search failed: ${message}`, {
          cause: err,
        });
      }
    }

    // Normal search: use cache
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
}
