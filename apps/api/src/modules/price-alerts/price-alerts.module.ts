import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceAlertEntity } from './entities/price-alert.entity';
import { PriceAlertsService } from './price-alerts.service';
import { PriceAlertsController } from './price-alerts.controller';
import { FlightSearchModule } from '../flight-search/flight-search.module';

@Module({
  imports: [TypeOrmModule.forFeature([PriceAlertEntity]), FlightSearchModule],
  providers: [PriceAlertsService],
  controllers: [PriceAlertsController],
})
export class PriceAlertsModule {}
