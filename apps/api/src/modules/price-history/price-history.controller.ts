import { Controller, Get, Query } from '@nestjs/common';
import { PriceHistoryService } from './price-history.service';

@Controller('price-history')
export class PriceHistoryController {
  constructor(private readonly priceHistoryService: PriceHistoryService) {}

  @Get()
  async getHistory(
    @Query('departure') departureId: string,
    @Query('arrival') arrivalId: string,
  ) {
    if (!departureId || !arrivalId) {
      return {
        records: [],
        message: 'Provide departure and arrival query params.',
      };
    }
    const records = await this.priceHistoryService.getHistoryForRoute(
      departureId,
      arrivalId,
    );
    return { records };
  }
}
