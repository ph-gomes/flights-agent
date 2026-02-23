import {
  IsEmail,
  IsNumber,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

export class CreatePriceAlertDto {
  @IsString()
  @MaxLength(10)
  departureId: string;

  @IsString()
  @MaxLength(10)
  arrivalId: string;

  /** YYYY-MM-DD */
  @IsString()
  @Matches(YYYY_MM_DD, { message: 'outboundDate must be YYYY-MM-DD' })
  outboundDate: string;

  @IsNumber()
  @Min(0.01, { message: 'targetPrice must be greater than 0' })
  targetPrice: number;

  @IsEmail()
  email: string;
}
