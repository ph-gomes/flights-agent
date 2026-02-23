/** Normalized search params for stable cache keys. */

export interface NormalizedSearchParams {
  departure_id: string;
  arrival_id: string;
  outbound_date: string;
  return_date: string | undefined;
  type: 1 | 2;
}
