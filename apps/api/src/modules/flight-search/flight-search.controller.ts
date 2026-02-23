import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import type { EngineParameters } from 'serpapi';
import { FlightSearchService } from './flight-search.service';

@Controller('flight-search')
export class FlightSearchController {
  constructor(private readonly flightSearchService: FlightSearchService) {}

  @Get('search')
  searchFlight(@Query() query: EngineParameters) {
    return this.flightSearchService.searchFlight(query);
  }

  /**
   * Fetch return-flight options for a round trip after the user selects an outbound flight.
   * Does not invoke the LLM; called directly from the frontend with the chosen outbound departure_token.
   */
  @Get('return-options')
  getReturnOptions(
    @Query('departure_token') departureToken: string,
    @Query('return_date') returnDate?: string,
  ) {
    const token = departureToken?.trim();
    if (!token) {
      throw new BadRequestException('departure_token is required');
    }
    return this.flightSearchService.getReturnOptions(token, returnDate);
  }
}
