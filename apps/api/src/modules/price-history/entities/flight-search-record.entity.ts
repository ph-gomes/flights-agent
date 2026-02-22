import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('flight_search_records')
export class FlightSearchRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  departureId: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  arrivalId: string | null;

  @Column({ type: 'date', nullable: true })
  outboundDate: string | null;

  @Column({ type: 'date', nullable: true })
  returnDate: string | null;

  @Column({ type: 'int', default: 2 })
  type: number; // 1 round trip, 2 one way, 3 multi-city

  /** Raw SerpAPI response JSON for price history comparison */
  @Column({ type: 'simple-json', nullable: true })
  resultPayload: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
