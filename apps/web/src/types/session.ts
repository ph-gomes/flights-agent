import type { FlightSearchResponse } from "./chat";

export interface SessionMessage {
  role: "user" | "assistant" | "system";
  content: string;
  flightResults?: FlightSearchResponse | null;
  /** Set for round-trip outbound-only results; used to fetch return options. */
  return_date?: string;
  /** Route (departure/arrival) for this block's price history; set when message has flight results. */
  priceHistoryRoute?: { departure: string; arrival: string } | null;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  messages: SessionMessage[];
  priceHistoryRoute?: { departure: string; arrival: string } | null;
}
