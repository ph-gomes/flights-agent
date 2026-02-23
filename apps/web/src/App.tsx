import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatMessage as ApiChatMessage, ChatResponse, FlightSearchResponse } from "./types/chat";
import { FlightResults } from "./components/FlightResults";
import { MarkdownContent } from "./components/MarkdownContent";
import { PriceHistoryPanel } from "./components/PriceHistoryPanel";
import { SkeletonResults } from "./components/SkeletonCard";
import "./App.css";

// ─── Suggested queries ───────────────────────────────────────────────────────

const SUGGESTED_QUERIES = [
  "Flights from NYC to London next weekend",
  "Cheapest round trip JFK → Paris in March",
  "Direct flights from LAX to Tokyo in April",
  "NYC to Rome, one way, late March",
];

// ─── Types ───────────────────────────────────────────────────────────────────

/** Extended message type that also carries structured flight data for display. */
type DisplayMessage = ApiChatMessage & {
  flightResults?: FlightSearchResponse | null;
};

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [priceHistoryRoute, setPriceHistoryRoute] = useState<{
    departure: string;
    arrival: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to the bottom whenever messages change or loading starts.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const query = (text ?? input).trim();
      if (!query || loading) return;

      const userMessage: DisplayMessage = { role: "user", content: query };
      const newMessages: DisplayMessage[] = [...messages, userMessage];
      setMessages(newMessages);
      setInput("");
      setLoading(true);
      setError(null);

      // Focus back on input after sending
      setTimeout(() => inputRef.current?.focus(), 0);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages.map(({ role, content }) => ({ role, content })),
          }),
        });

        const data = (await res.json()) as ChatResponse & { message?: string };

        if (!res.ok) {
          const msg = data?.message ?? `Request failed: ${res.status}`;
          throw new Error(msg);
        }

        const assistantMessage: DisplayMessage = {
          role: "assistant",
          content: data.message,
          flightResults: data.flightResults ?? null,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Auto-extract route for price history from the first result
        if (data.flightResults) {
          const fr = data.flightResults as FlightSearchResponse;
          const firstOption = fr.best_flights?.[0] ?? fr.other_flights?.[0];
          if (firstOption) {
            const segs = firstOption.flights ?? [];
            const dep =
              segs[0]?.departure_airport?.id ??
              (firstOption as { departure_airport?: { id?: string } })
                .departure_airport?.id;
            const lastSeg = segs[segs.length - 1];
            const arr =
              lastSeg?.arrival_airport?.id ??
              (firstOption as { arrival_airport?: { id?: string } })
                .arrival_airport?.id;
            if (dep && arr) {
              setPriceHistoryRoute({ departure: dep, arrival: arr });
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages],
  );

  const openPriceHistory = useCallback(() => setShowPriceHistory(true), []);
  const closePriceHistory = useCallback(() => setShowPriceHistory(false), []);

  const hasFlightResults = messages.some(
    (m) => m.role === "assistant" && m.flightResults,
  );

  const isEmptyState = messages.length === 0 && !loading;

  return (
    <div className="app app-dark">
      <main className="app-main">
        {/* ── Header ── */}
        <header className="app-header">
          <div className="app-header-brand">
            <PlaneSVG />
            <span>Thrifty Traveler</span>
          </div>
          <p className="app-header-sub">AI-Powered Flight Search</p>
        </header>

        {/* ── Messages ── */}
        <div className="chat-container">
          <div className="messages" role="log" aria-live="polite">

            {/* Empty state */}
            {isEmptyState && (
              <div className="messages-empty-state">
                <PlaneSVG large />
                <h2>Where do you want to go?</h2>
                <p>Ask me to find flights in plain English. I'll search Google Flights in real time.</p>
              </div>
            )}

            {/* Message bubbles */}
            {messages.map((m, i) => (
              <div key={i} className={`message message-${m.role}`}>
                <span className="message-role">
                  {m.role === "user" ? "You" : "Assistant"}
                </span>
                {m.role === "assistant" ? (
                  <>
                    <div className="message-content">
                      <MarkdownContent content={m.content} />
                    </div>
                    {m.flightResults && (
                      <div className="message-cards">
                        <FlightResults data={m.flightResults} />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="message-content">{m.content}</div>
                )}
              </div>
            ))}

            {/* Loading state: typing + skeleton cards */}
            {loading && (
              <div className="message message-assistant">
                <span className="message-role">Assistant</span>
                <div className="message-content typing">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  Searching Google Flights…
                </div>
                <div className="message-cards">
                  <SkeletonResults count={3} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button
                type="button"
                className="error-banner-dismiss"
                onClick={() => setError(null)}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          {hasFlightResults && (
            <p className="app-disclaimer">
              Prices and availability change frequently. Check the airline or
              booking site for the latest details before purchasing.
            </p>
          )}
        </div>

        {/* ── Input area ── */}
        <div className="app-input-area">
          <div className="app-input-chips">
            {/* Suggested queries shown only on empty state */}
            {isEmptyState &&
              SUGGESTED_QUERIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="app-chip"
                  onClick={() => sendMessage(q)}
                >
                  {q}
                </button>
              ))}

            {/* Price history chip – shown once we have results */}
            {priceHistoryRoute && !isEmptyState && (
              <button
                type="button"
                className="app-chip app-chip-accent"
                onClick={openPriceHistory}
              >
                📈 {priceHistoryRoute.departure} → {priceHistoryRoute.arrival} price history
              </button>
            )}
          </div>

          <div className="input-row input-row-pro">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && sendMessage()
              }
              placeholder={'Ask about flights… e.g. "JFK to CDG next Friday"'}
              aria-label="Message"
              disabled={loading}
            />
            <button
              type="button"
              className="app-input-send"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              aria-label="Send"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </main>

      {/* ── Price History Panel (slide-over) ── */}
      {showPriceHistory && (
        <>
          <div
            className="overlay"
            onClick={closePriceHistory}
            aria-hidden
          />
          <div className="panel-wrapper">
            {priceHistoryRoute ? (
              <PriceHistoryPanel
                departureId={priceHistoryRoute.departure}
                arrivalId={priceHistoryRoute.arrival}
                onClose={closePriceHistory}
              />
            ) : (
              <PriceHistoryRouteForm
                onLoad={(dep, arr) =>
                  setPriceHistoryRoute({ departure: dep, arrival: arr })
                }
                onClose={closePriceHistory}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Route form (when no route auto-detected) ─────────────────────────────────

function PriceHistoryRouteForm({
  onLoad,
  onClose,
}: {
  onLoad: (departure: string, arrival: string) => void;
  onClose: () => void;
}) {
  const [dep, setDep] = useState("");
  const [arr, setArr] = useState("");

  return (
    <div
      className="price-history-panel"
      role="dialog"
      aria-label="Price history"
    >
      <div className="price-history-header">
        <div className="ph-header-title">
          <h3>Price history</h3>
          <p className="ph-subtitle">Enter a route to view historical prices</p>
        </div>
        <button
          type="button"
          className="ph-close-btn"
          onClick={onClose}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="price-history-form">
        <input
          type="text"
          placeholder="Departure (e.g. JFK)"
          value={dep}
          onChange={(e) => setDep(e.target.value.toUpperCase())}
          maxLength={3}
        />
        <input
          type="text"
          placeholder="Arrival (e.g. CDG)"
          value={arr}
          onChange={(e) => setArr(e.target.value.toUpperCase())}
          maxLength={3}
        />
        <button
          type="button"
          className="ph-load-btn"
          onClick={() =>
            dep.trim().length === 3 &&
            arr.trim().length === 3 &&
            onLoad(dep.trim(), arr.trim())
          }
          disabled={dep.trim().length !== 3 || arr.trim().length !== 3}
        >
          Load history
        </button>
      </div>
    </div>
  );
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function PlaneSVG({ large }: { large?: boolean }) {
  return (
    <svg
      className={large ? "app-hero-icon" : "app-brand-icon"}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </svg>
  );
}
