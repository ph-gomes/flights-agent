import { Module } from '@nestjs/common';
import { FlightSearchService } from './flight-search.service';
import { FlightSearchController } from './flight-search.controller';
import { AppCacheModule } from '../../cache.module';

@Module({
  imports: [AppCacheModule],
  controllers: [FlightSearchController],
  providers: [FlightSearchService],
})
export class FlightSearchModule {}
