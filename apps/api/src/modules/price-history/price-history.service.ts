import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlightSearchRecord } from './entities/flight-search-record.entity';
import type { BaseResponse } from 'serpapi';

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
      resultPayload: results as unknown as Record<string, unknown>,
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
}
