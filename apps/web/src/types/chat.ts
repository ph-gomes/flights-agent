export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  /** When present, flight option cards are shown inline in this message (assistant only). */
  flightResults?: FlightSearchResponse | null;
}

export interface ChatResponse {
  message: string;
  flightResults?: FlightSearchResponse | null;
}

/** Minimal shape for SerpAPI Google Flights response (for display). */
export interface FlightSearchResponse {
  best_flights?: FlightOption[];
  other_flights?: FlightOption[];
  price_insights?: { lowest_price?: number };
}

export interface FlightOption {
  price?: number;
  departure_airport?: { name?: string };
  arrival_airport?: { name?: string };
  airline?: string;
  outbound_duration?: string;
  return_duration?: string;
  flights?: Array<{
    departure_airport?: { name?: string };
    arrival_airport?: { name?: string };
    duration?: number;
    airline?: string;
  }>;
}
