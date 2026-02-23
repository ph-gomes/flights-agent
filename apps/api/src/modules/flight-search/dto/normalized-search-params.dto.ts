/** Normalized search params for stable cache keys and SerpAPI payload. */

export interface NormalizedSearchParams {
  departure_id: string;
  arrival_id: string;
  outbound_date: string;
  return_date: string | undefined;
  type: 1 | 2;
  adults?: number;
  children?: number;
  travel_class?: number;
  stops?: number;
  max_price?: number;
  outbound_times?: string;
  return_times?: string;
  include_airlines?: string;
  exclude_airlines?: string;
  sort_by?: number;
}
