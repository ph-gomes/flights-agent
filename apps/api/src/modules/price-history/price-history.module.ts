import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlightSearchRecord } from './entities/flight-search-record.entity';
import { PriceHistoryController } from './price-history.controller';
import { PriceHistoryService } from './price-history.service';

@Module({
  imports: [TypeOrmModule.forFeature([FlightSearchRecord])],
  controllers: [PriceHistoryController],
  providers: [PriceHistoryService],
  exports: [PriceHistoryService],
})
export class PriceHistoryModule {}
