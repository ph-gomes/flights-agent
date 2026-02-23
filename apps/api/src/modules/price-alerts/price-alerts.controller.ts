import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PriceAlertsService } from './price-alerts.service';
import { CreatePriceAlertDto } from './dto/create-price-alert.dto';

@Controller('price-alerts')
export class PriceAlertsController {
  constructor(private readonly alertsService: PriceAlertsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  create(@Body() body: CreatePriceAlertDto) {
    return this.alertsService.create(body);
  }

  @Get()
  list(@Query('email') email?: string) {
    return this.alertsService.listByEmail(email);
  }
}
