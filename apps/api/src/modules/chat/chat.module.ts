import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { FlightSearchModule } from '../flight-search/flight-search.module';
import { PriceHistoryModule } from '../price-history/price-history.module';

@Module({
  imports: [FlightSearchModule, PriceHistoryModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
