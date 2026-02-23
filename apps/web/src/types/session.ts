import type { FlightSearchResponse } from "./chat";

export interface SessionMessage {
  role: "user" | "assistant" | "system";
  content: string;
  flightResults?: FlightSearchResponse | null;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  messages: SessionMessage[];
  priceHistoryRoute?: { departure: string; arrival: string } | null;
}
