import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CreatePriceAlertDto } from '@repo/types';
import { PriceAlertEntity } from './entities/price-alert.entity';
import { FlightSearchService } from '../flight-search/flight-search.service';
import { extractLowestPrice } from '../price-history/price-history.util';

@Injectable()
export class PriceAlertsService {
  private readonly logger = new Logger(PriceAlertsService.name);

  constructor(
    @InjectRepository(PriceAlertEntity)
    private readonly alertRepo: Repository<PriceAlertEntity>,
    private readonly flightSearchService: FlightSearchService,
  ) {}

  create(dto: CreatePriceAlertDto): Promise<PriceAlertEntity> {
    const alert = this.alertRepo.create({
      departureId: dto.departureId.toUpperCase(),
      arrivalId: dto.arrivalId.toUpperCase(),
      outboundDate: dto.outboundDate,
      targetPrice: dto.targetPrice,
      email: dto.email,
      status: 'active',
      triggeredAt: null,
    });
    return this.alertRepo.save(alert);
  }

  listByEmail(email?: string): Promise<PriceAlertEntity[]> {
    const where = email ? { email } : {};
    return this.alertRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  /**
   * Polls all active price alerts every 10 minutes.
   * Uses the existing Redis-cached FlightSearchService to minimise SerpAPI calls.
   * When a price drops at or below the target, the alert is marked triggered
   * and a simulated email notification is logged.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async pollAlerts(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const active = await this.alertRepo.find({ where: { status: 'active' } });

    if (active.length === 0) return;
    this.logger.log(`Polling ${active.length} active price alert(s)…`);

    for (const alert of active) {
      // Expire alerts whose departure date has passed
      if (alert.outboundDate < today) {
        alert.status = 'expired';
        await this.alertRepo.save(alert);
        this.logger.debug(
          `Alert ${alert.id} expired (date ${alert.outboundDate} is past)`,
        );
        continue;
      }

      try {
        const result = await this.flightSearchService.searchFlight({
          departure_id: alert.departureId,
          arrival_id: alert.arrivalId,
          outbound_date: alert.outboundDate,
          type: 2,
        });

        const currentPrice = extractLowestPrice(result);

        if (currentPrice == null) continue;

        this.logger.debug(
          `Alert ${alert.id}: current $${currentPrice}, target $${alert.targetPrice}`,
        );

        if (currentPrice <= alert.targetPrice) {
          alert.status = 'triggered';
          alert.triggeredAt = new Date();
          await this.alertRepo.save(alert);
          this.logger.log(
            `[ALERT TRIGGERED] To: ${alert.email} | ` +
              `${alert.departureId}→${alert.arrivalId} on ${alert.outboundDate} ` +
              `is now $${currentPrice} (target $${alert.targetPrice}). ` +
              `[SIMULATED EMAIL SENT]`,
          );
        }
      } catch (err: unknown) {
        this.logger.warn(
          `Poll error for alert ${alert.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
