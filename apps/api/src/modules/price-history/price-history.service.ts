import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlightSearchRecord } from './entities/flight-search-record.entity';
import type { BaseResponse } from 'serpapi';
import type { PriceHistoryRecordDto } from './dto/price-history-response.dto';
import { extractLowestPrice } from './price-history.util';

export interface FlightSearchParams {
  departure_id?: string;
  arrival_id?: string;
  outbound_date?: string;
  return_date?: string;
  type?: number;
}

@Injectable()
export class PriceHistoryService {
  constructor(
    @InjectRepository(FlightSearchRecord)
    private readonly recordRepo: Repository<FlightSearchRecord>,
  ) {}

  async saveSearch(
    params: FlightSearchParams,
    results: BaseResponse,
  ): Promise<FlightSearchRecord> {
    const record = this.recordRepo.create({
      departureId: params.departure_id ?? null,
      arrivalId: params.arrival_id ?? null,
      outboundDate: params.outbound_date ?? null,
      returnDate: params.return_date ?? null,
      type: params.type ?? 2,
      resultPayload: results,
    });
    return this.recordRepo.save(record);
  }

  async getHistoryForRoute(
    departureId: string,
    arrivalId: string,
  ): Promise<FlightSearchRecord[]> {
    return this.recordRepo.find({
      where: { departureId, arrivalId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  /**
   * Returns price history for a route as DTOs with lowestPrice extracted for comparison.
   */
  async getHistoryForRouteDto(
    departureId: string,
    arrivalId: string,
  ): Promise<PriceHistoryRecordDto[]> {
    const records = await this.getHistoryForRoute(departureId, arrivalId);
    return records.map((r) => toRecordDto(r));
  }
}

function toRecordDto(record: FlightSearchRecord): PriceHistoryRecordDto {
  return {
    id: record.id,
    departureId: record.departureId,
    arrivalId: record.arrivalId,
    outboundDate: record.outboundDate,
    returnDate: record.returnDate,
    type: record.type,
    createdAt: record.createdAt.toISOString(),
    lowestPrice: extractLowestPrice(record.resultPayload),
  };
}
