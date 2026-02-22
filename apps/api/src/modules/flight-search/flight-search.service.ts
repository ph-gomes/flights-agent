import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseResponse, EngineParameters, getJson } from 'serpapi';

@Injectable()
export class FlightSearchService {
  private apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.apiKey = this.configService.get('SERP_API_KEY') ?? '';
  }

  async _searchFlight(parameters: EngineParameters): Promise<BaseResponse> {
    const json = await getJson({
      ...parameters,
      api_key: this.apiKey,
    });

    return json;
  }

  async searchFlight(parameters: EngineParameters): Promise<BaseResponse> {
    const cacheKey = JSON.stringify(parameters);
    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) {
      return cachedData as BaseResponse;
    }
    const data = await this._searchFlight(parameters);
    await this.cacheManager.set(cacheKey, data);
    return data;
  }
}
