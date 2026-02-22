import { Controller, Get, Query } from '@nestjs/common';
import { PriceHistoryService } from './price-history.service';
import type { PriceHistoryResponseDto } from './dto/price-history-response.dto';

@Controller('price-history')
export class PriceHistoryController {
  constructor(private readonly priceHistoryService: PriceHistoryService) {}

  @Get()
  async getHistory(
    @Query('departure') departureId: string,
    @Query('arrival') arrivalId: string,
  ): Promise<PriceHistoryResponseDto & { message?: string }> {
    if (!departureId?.trim() || !arrivalId?.trim()) {
      return {
        records: [],
        message: 'Provide departure and arrival query params.',
      };
    }
    const records = await this.priceHistoryService.getHistoryForRouteDto(
      departureId.trim(),
      arrivalId.trim(),
    );
    return { records };
  }
}
