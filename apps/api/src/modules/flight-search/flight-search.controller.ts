import { Controller, Get, Query } from '@nestjs/common';
import { FlightSearchService } from './flight-search.service';
import type { EngineParameters } from 'node_modules/serpapi/esm/src/types';

@Controller('flight-search')
export class FlightSearchController {
  constructor(private readonly flightSearchService: FlightSearchService) {}

  @Get('search')
  async searchFlight(@Query() query: EngineParameters) {
    return this.flightSearchService.searchFlight(query);
  }
}
