import { useState, useCallback } from "react";
import type { ChatMessage as ApiChatMessage, ChatResponse } from "./types/chat";
import { FlightResults } from "./components/FlightResults";
import { MarkdownContent } from "./components/MarkdownContent";
import { PriceHistoryPanel } from "./components/PriceHistoryPanel";
import "./App.css";

export default function App() {
  const [messages, setMessages] = useState<ApiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [priceHistoryRoute, setPriceHistoryRoute] = useState<{
    departure: string;
    arrival: string;
  } | null>(null);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: ApiChatMessage = { role: "user", content: text };
    const newMessages: ApiChatMessage[] = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);

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
      const assistantMessage: ApiChatMessage = {
        role: "assistant",
        content: data.message,
        flightResults: data.flightResults ?? null,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.flightResults && "best_flights" in data.flightResults) {
        const first =
          data.flightResults.best_flights?.[0] ??
          data.flightResults.other_flights?.[0];
        const dep = (first as { departure_airport?: { id?: string } })
          ?.departure_airport?.id;
        const arr = (first as { arrival_airport?: { id?: string } })
          ?.arrival_airport?.id;
        if (dep && arr) {
          setPriceHistoryRoute({ departure: dep, arrival: arr });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const openPriceHistory = useCallback(() => {
    setShowPriceHistory(true);
  }, []);

  const closePriceHistory = useCallback(() => {
    setShowPriceHistory(false);
    setPriceHistoryRoute(null);
  }, []);

  const hasAnyFlightResults = messages.some(
    (m) => m.role === "assistant" && m.flightResults,
  );

  return (
    <div className="app app-dark">
      <main className="app-main">
        <div className="chat-container">
          <div className="messages" role="log" aria-live="polite">
            {messages.length === 0 && (
              <p className="messages-empty">
                Send a message to search for flights.
              </p>
            )}
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
            {loading && (
              <div className="message message-assistant">
                <span className="message-role">Assistant</span>
                <div className="message-content typing">Searching…</div>
              </div>
            )}
          </div>

          {error && <p className="error">{error}</p>}

          {hasAnyFlightResults && (
            <p className="app-disclaimer">
              Prices and availability may vary. Check the airline or agency for
              the latest details.
            </p>
          )}
        </div>

        <div className="app-input-area">
          <div className="app-input-chips">
            <button
              type="button"
              className="app-chip"
              onClick={openPriceHistory}
            >
              View price history
            </button>
          </div>
          <div className="input-row input-row-pro">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && sendMessage()
              }
              placeholder="Write your question..."
              aria-label="Message"
              disabled={loading}
            />
            <button
              type="button"
              className="app-input-send"
              onClick={sendMessage}
              disabled={loading}
              aria-label="Send"
            >
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
            </button>
          </div>
        </div>
      </main>

      {showPriceHistory && (
        <>
          <div className="overlay" onClick={closePriceHistory} aria-hidden />
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
        <h3>Price history</h3>
        <button type="button" onClick={onClose} aria-label="Close">
          Close
        </button>
      </div>
      <p>Enter route (e.g. JFK, CDG)</p>
      <div className="price-history-form">
        <input
          type="text"
          placeholder="Departure (e.g. JFK)"
          value={dep}
          onChange={(e) => setDep(e.target.value)}
        />
        <input
          type="text"
          placeholder="Arrival (e.g. CDG)"
          value={arr}
          onChange={(e) => setArr(e.target.value)}
        />
        <button
          type="button"
          onClick={() =>
            dep.trim() && arr.trim() && onLoad(dep.trim(), arr.trim())
          }
        >
          Load history
        </button>
      </div>
    </div>
  );
}
