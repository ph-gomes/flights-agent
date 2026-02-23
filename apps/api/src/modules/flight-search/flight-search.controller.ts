import { Controller, Get, Query } from '@nestjs/common';
import type { EngineParameters } from 'serpapi';
import { FlightSearchService } from './flight-search.service';

@Controller('flight-search')
export class FlightSearchController {
  constructor(private readonly flightSearchService: FlightSearchService) {}

  @Get('search')
  searchFlight(@Query() query: EngineParameters) {
    return this.flightSearchService.searchFlight(query);
  }
}
