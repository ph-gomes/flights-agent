/**
 * Single record in the price history for a route (for comparison over time).
 */
export interface PriceHistoryRecordDto {
  id: string;
  departureId: string | null;
  arrivalId: string | null;
  outboundDate: string | null;
  returnDate: string | null;
  type: number;
  createdAt: string; // ISO date string
  /** Lowest price from the search result, when available (e.g. from best_flights or price_insights). */
  lowestPrice: number | null;
}

export interface PriceHistoryResponseDto {
  records: PriceHistoryRecordDto[];
}
