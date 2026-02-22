export interface PriceHistoryRecord {
  id: string;
  departureId: string | null;
  arrivalId: string | null;
  outboundDate: string | null;
  returnDate: string | null;
  type: number;
  createdAt: string;
  lowestPrice: number | null;
}

export interface PriceHistoryResponse {
  records: PriceHistoryRecord[];
  message?: string;
}
