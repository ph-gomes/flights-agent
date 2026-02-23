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
