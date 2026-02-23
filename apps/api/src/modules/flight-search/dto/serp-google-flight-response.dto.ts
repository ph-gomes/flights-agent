import { FlightOption, PriceInsights } from '@repo/types';

export interface SerpGoogleFlightResponseDto {
  best_flights?: FlightOption[];
  other_flights?: FlightOption[];
  price_insights?: PriceInsights;
}
