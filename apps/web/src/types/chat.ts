// Re-export canonical types from shared package so the rest of the app
// can import from one place without changing every import path.
export type {
  AirportRef,
  LayoverInfo,
  FlightSegment as FlightLeg,
  CarbonEmissions,
  FlightOption,
  PriceInsights,
  FlightSearchResult as FlightSearchResponse,
  ChatMessage,
  ChatResponse,
} from "@repo/types";
