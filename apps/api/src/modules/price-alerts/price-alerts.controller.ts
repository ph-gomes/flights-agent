import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { CreatePriceAlertDto } from '@repo/types';
import { PriceAlertsService } from './price-alerts.service';

@Controller('price-alerts')
export class PriceAlertsController {
  constructor(private readonly alertsService: PriceAlertsService) {}

  @Post()
  create(@Body() body: CreatePriceAlertDto) {
    return this.alertsService.create(body);
  }

  @Get()
  list(@Query('email') email?: string) {
    return this.alertsService.listByEmail(email);
  }
}
