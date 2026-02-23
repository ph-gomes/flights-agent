import { Controller, Get, Query } from '@nestjs/common';
import type { EngineParameters } from 'serpapi';
import { FlightSearchService } from './flight-search.service';

@Controller('flight-search')
export class FlightSearchController {
  constructor(private readonly flightSearchService: FlightSearchService) {}

  /**
   * Search flights. With departure_id, arrival_id, outbound_date (and optional return_date) = initial search.
   * With departure_token + outbound_date (+ same route/dates) = return-flight options for round trip.
   */
  @Get('search')
  searchFlight(@Query() query: EngineParameters & Record<string, string>) {
    return this.flightSearchService.searchFlight(query);
  }
}
