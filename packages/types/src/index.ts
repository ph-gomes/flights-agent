/**
 * Shared TypeScript interfaces for the Thrifty Flight Agent.
 * Consumed by both `apps/api` and `apps/web`.
 */

// ─── Airport / Segment types ────────────────────────────────────────────────

export interface AirportRef {
  /** IATA airport code, e.g. "JFK" */
  id?: string;
  /** Human-readable airport name */
  name?: string;
  /** Local datetime string: "2025-03-01 10:00" */
  time?: string;
}

export interface LayoverInfo {
  /** Airport IATA code for the layover */
  id?: string;
  /** Airport name */
  name?: string;
  /** Layover duration in minutes */
  duration?: number;
}

/** One physical hop in a journey (JFK→AMS, AMS→CDG, etc.). */
export interface FlightSegment {
  departure_airport?: AirportRef;
  arrival_airport?: AirportRef;
  /** Segment flight time in minutes */
  duration?: number;
  airline?: string;
  airline_logo?: string;
  flight_number?: string;
  airplane?: string;
  travel_class?: string;
  legroom?: string;
  extensions?: string[];
}

// ─── Flight Option ──────────────────────────────────────────────────────────

export interface CarbonEmissions {
  /** Grams of CO₂ for this flight */
  this_flight?: number;
  /** Grams of CO₂ for a typical flight on this route */
  typical_for_this_route?: number;
  /** Difference percentage vs. typical (negative = greener) */
  difference_percent?: number;
}

/**
 * A complete flight option returned by SerpAPI Google Flights.
 * Represents one bookable itinerary (may have multiple segments + layovers).
 */
export interface FlightOption {
  /** Array of flight segments (hops) in the itinerary */
  flights?: FlightSegment[];
  /** Layover info between consecutive segments */
  layovers?: LayoverInfo[];
  /** Total door-to-door duration in minutes */
  total_duration?: number;
  /** Total price in USD */
  price?: number;
  /** "One way" | "Round trip" */
  type?: string;
  /** Primary carrier name */
  airline?: string;
  /** Primary carrier logo URL */
  airline_logo?: string;
  carbon_emissions?: CarbonEmissions;
  extensions?: string[];
  booking_token?: string;
  departure_token?: string;
}

// ─── Flight search parameters (SerpAPI Google Flights) ────────────────────────

/** Optional parameters for SerpAPI Google Flights. All fields optional except where used for return-options. */
export interface FlightSearchParams {
  /** Departure airport IATA code(s), comma-separated (e.g. "JFK" or "JFK,EWR") */
  departure_id?: string;
  /** Arrival airport IATA code(s), comma-separated */
  arrival_id?: string;
  /** Outbound date YYYY-MM-DD */
  outbound_date?: string;
  /** Return date YYYY-MM-DD (required for round trip) */
  return_date?: string;
  /** 1 = round trip, 2 = one way, 3 = multi-city */
  type?: 1 | 2 | 3;
  /** Number of adults. Default 1 */
  adults?: number;
  /** Number of children. Default 0 */
  children?: number;
  /** Infants in seat. Default 0 */
  infants_in_seat?: number;
  /** Infants on lap. Default 0 */
  infants_on_lap?: number;
  /** 1 = Economy, 2 = Premium economy, 3 = Business, 4 = First */
  travel_class?: 1 | 2 | 3 | 4;
  /** 0 = any stops, 1 = nonstop only, 2 = 1 stop or fewer, 3 = 2 stops or fewer */
  stops?: 0 | 1 | 2 | 3;
  /** Maximum ticket price in USD (or currency unit) */
  max_price?: number;
  /** Outbound time range: "startHour,endHour" or "depStart,depEnd,arrStart,arrEnd" (0-23) */
  outbound_times?: string;
  /** Return time range (round trip only). Same format as outbound_times */
  return_times?: string;
  /** Airline codes to include, comma-separated (e.g. "DL,AA" or "SKYTEAM"). Mutually exclusive with exclude_airlines */
  include_airlines?: string;
  /** Airline codes to exclude, comma-separated. Mutually exclusive with include_airlines */
  exclude_airlines?: string;
  /** Sort: 1 = top, 2 = price, 3 = departure time, 4 = arrival time, 5 = duration, 6 = emissions */
  sort_by?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Max flight duration in minutes */
  max_duration?: number;
  /** Layover duration range in minutes: "min,max" */
  layover_duration?: string;
  /** Connecting airport codes to exclude, comma-separated */
  exclude_conns?: string;
  /** 1 = less emissions only */
  emissions?: 1;
  /** Carry-on bags count (0 by default) */
  bags?: number;
  /** Currency code (e.g. "USD"). Default USD */
  currency?: string;
  /** For return-flight request only: token from selected outbound flight */
  departure_token?: string;
}

// ─── Search result wrapper ───────────────────────────────────────────────────

export interface PriceInsights {
  lowest_price?: number;
  price_level?: string;
  typical_price_range?: [number, number];
  price_history?: Array<[number, number]>;
}

export interface FlightSearchResult {
  best_flights?: FlightOption[];
  other_flights?: FlightOption[];
  price_insights?: PriceInsights;
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatResponse {
  message: string;
  flightResults?: FlightSearchResult | null;
  /** Present when round-trip was searched as outbound-only; frontend uses it for return-options API. */
  return_date?: string;
}

// ─── Price Alerts ────────────────────────────────────────────────────────────

export type PriceAlertStatus = "active" | "triggered" | "expired";

export interface PriceAlert {
  id: string;
  departureId: string;
  arrivalId: string;
  /** YYYY-MM-DD */
  outboundDate: string;
  targetPrice: number;
  email: string;
  status: PriceAlertStatus;
  createdAt: string;
  triggeredAt: string | null;
}

export interface CreatePriceAlertDto {
  departureId: string;
  arrivalId: string;
  /** YYYY-MM-DD */
  outboundDate: string;
  targetPrice: number;
  email: string;
}

// ─── Price History ────────────────────────────────────────────────────────────

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
}
