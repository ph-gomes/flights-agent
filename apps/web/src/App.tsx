import { useState, useCallback } from "react";
import type { ChatMessage as ApiChatMessage, ChatResponse } from "./types/chat";
import { FlightResults } from "./components/FlightResults";
import { PriceHistoryPanel } from "./components/PriceHistoryPanel";
import "./App.css";

export default function App() {
  const [messages, setMessages] = useState<ApiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flightResults, setFlightResults] = useState<ChatResponse["flightResults"]>(null);
  const [lastRoute, setLastRoute] = useState<{ departure: string; arrival: string } | null>(null);
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
    setFlightResults(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = (await res.json()) as ChatResponse & { message?: string };
      if (!res.ok) {
        const msg = data?.message ?? `Request failed: ${res.status}`;
        throw new Error(msg);
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
      setFlightResults(data.flightResults ?? null);
      if (data.flightResults && "best_flights" in data.flightResults) {
        const first = data.flightResults.best_flights?.[0] ?? data.flightResults.other_flights?.[0];
        const dep = (first as { departure_airport?: { id?: string } })?.departure_airport?.id;
        const arr = (first as { arrival_airport?: { id?: string } })?.arrival_airport?.id;
        if (dep && arr) setLastRoute({ departure: dep, arrival: arr });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const openPriceHistory = useCallback(() => {
    if (lastRoute) {
      setPriceHistoryRoute(lastRoute);
      setShowPriceHistory(true);
    } else {
      setPriceHistoryRoute(null);
      setShowPriceHistory(true);
    }
  }, [lastRoute]);

  const closePriceHistory = useCallback(() => {
    setShowPriceHistory(false);
    setPriceHistoryRoute(null);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Flight search</h1>
        <p className="subtitle">Ask for flights in plain language (e.g. “Flights from JFK to Paris next weekend”).</p>
      </header>

      <main className="app-main">
        <div className="chat-container">
          <div className="messages" role="log" aria-live="polite">
            {messages.length === 0 && (
              <p className="messages-empty">Send a message to search for flights.</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`message message-${m.role}`}>
                <span className="message-role">{m.role === "user" ? "You" : "Assistant"}</span>
                <div className="message-content">{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="message message-assistant">
                <span className="message-role">Assistant</span>
                <div className="message-content typing">Searching…</div>
              </div>
            )}
          </div>

          {flightResults && <FlightResults data={flightResults} />}

          {error && <p className="error">{error}</p>}

          <div className="input-row">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="e.g. Flights from JFK to CDG on 2025-03-01"
              aria-label="Message"
              disabled={loading}
            />
            <button type="button" onClick={sendMessage} disabled={loading}>
              Send
            </button>
          </div>

          <div className="actions">
            <button type="button" className="link-button" onClick={openPriceHistory}>
              View price history
            </button>
          </div>
        </div>

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
                  onLoad={(dep, arr) => setPriceHistoryRoute({ departure: dep, arrival: arr })}
                  onClose={closePriceHistory}
                />
              )}
            </div>
          </>
        )}
      </main>
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
    <div className="price-history-panel" role="dialog" aria-label="Price history">
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
          onClick={() => dep.trim() && arr.trim() && onLoad(dep.trim(), arr.trim())}
        >
          Load history
        </button>
      </div>
    </div>
  );
}
