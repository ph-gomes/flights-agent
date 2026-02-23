import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { PriceAlertStatus } from '@repo/types';

@Entity('price_alerts')
export class PriceAlertEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10 })
  departureId: string;

  @Column({ type: 'varchar', length: 10 })
  arrivalId: string;

  /** YYYY-MM-DD */
  @Column({ type: 'varchar', length: 20 })
  outboundDate: string;

  @Column({ type: 'float' })
  targetPrice: number;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: PriceAlertStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  triggeredAt: Date | null;
}
