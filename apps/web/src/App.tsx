import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatResponse, FlightSearchResponse } from "./types/chat";
import type { SessionMessage } from "./types/session";
import { FlightResults } from "./components/FlightResults";
import { MarkdownContent } from "./components/MarkdownContent";
import { PriceHistoryPanel } from "./components/PriceHistoryPanel";
import { SkeletonResults } from "./components/SkeletonCard";
import { Sidebar } from "./components/Sidebar";
import { useChatSessions } from "./hooks/useChatSessions";
import "./App.css";

// ─── Suggested queries ───────────────────────────────────────────────────────

const SUGGESTED_QUERIES = [
  "Flights from NYC to London next weekend",
  "Cheapest round trip JFK → Paris in March",
  "Direct flights from LAX to Tokyo in April",
  "NYC to Rome, one way, late March",
];

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const {
    sessions,
    activeId,
    activeSession,
    newSession,
    saveSession,
    switchSession,
    deleteSession,
  } = useChatSessions();

  // ── Local UI state ────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<SessionMessage[]>(
    () => activeSession?.messages ?? [],
  );
  const [priceHistoryRoute, setPriceHistoryRoute] = useState<{
    departure: string;
    arrival: string;
  } | null>(() => activeSession?.priceHistoryRoute ?? null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Auto-scroll to bottom on new messages ─────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Sync local state when the active session changes ─────────────────────
  const prevActiveIdRef = useRef<string | null>(activeId);
  useEffect(() => {
    if (prevActiveIdRef.current === activeId) return;
    prevActiveIdRef.current = activeId;
    setMessages((activeSession?.messages as SessionMessage[]) ?? []);
    setPriceHistoryRoute(activeSession?.priceHistoryRoute ?? null);
    setInput("");
    setError(null);
    setShowPriceHistory(false);
  }, [activeId, activeSession]);

  // ── On mount: ensure there is always at least one active session ──────────
  useEffect(() => {
    if (!activeId) newSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Send a message ───────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text?: string) => {
      const query = (text ?? input).trim();
      if (!query || loading) return;

      // Ensure we have an active session (create one on first send if needed)
      if (!activeId) newSession();

      const userMessage: SessionMessage = { role: "user", content: query };
      const nextMessages: SessionMessage[] = [...messages, userMessage];

      setMessages(nextMessages);
      setInput("");
      setLoading(true);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 0);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextMessages.map(({ role, content }) => ({
              role,
              content,
            })),
          }),
        });

        const data = (await res.json()) as ChatResponse & { message?: string };
        if (!res.ok) {
          throw new Error(data?.message ?? `Request failed: ${res.status}`);
        }

        const assistantMessage: SessionMessage = {
          role: "assistant",
          content: data.message,
          flightResults: data.flightResults ?? null,
        };
        const withReply = [...nextMessages, assistantMessage];
        setMessages(withReply);

        // Extract route for price history
        let newRoute = priceHistoryRoute;
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
              newRoute = { departure: dep, arrival: arr };
              setPriceHistoryRoute(newRoute);
            }
          }
        }

        // Persist to localStorage
        saveSession(withReply, newRoute);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, activeId, priceHistoryRoute, newSession, saveSession],
  );

  // ─── Session actions ──────────────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    newSession();
    // Local state will be cleared via the activeId useEffect above
  }, [newSession]);

  const handleSwitchSession = useCallback(
    (id: string) => {
      switchSession(id);
      setShowPriceHistory(false);
    },
    [switchSession],
  );

  // ─── Price history ────────────────────────────────────────────────────────
  const openPriceHistory = useCallback(() => setShowPriceHistory(true), []);
  const closePriceHistory = useCallback(() => setShowPriceHistory(false), []);

  const hasFlightResults = messages.some(
    (m) => m.role === "assistant" && m.flightResults,
  );
  const isEmptyState = messages.length === 0 && !loading;

  return (
    <div className={`app app-dark ${sidebarOpen ? "app-sidebar-open" : ""}`}>

      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
          <Sidebar
            sessions={sessions}
            activeId={activeId}
            onNew={handleNewChat}
            onSwitch={handleSwitchSession}
            onDelete={deleteSession}
            onClose={() => setSidebarOpen(false)}
          />
        </>
      )}

      {/* ── Main area ── */}
      <main className="app-main">
        {/* Header */}
        <header className="app-header">
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            <MenuIcon />
          </button>
          <div className="app-header-brand">
            <PlaneSVG />
            <span>Thrifty Traveler</span>
          </div>
          <p className="app-header-sub">AI-Powered Flight Search</p>
        </header>

        {/* Messages */}
        <div className="chat-container">
          <div className="messages" role="log" aria-live="polite">

            {/* Empty state */}
            {isEmptyState && (
              <div className="messages-empty-state">
                <PlaneSVG large />
                <h2>Where do you want to go?</h2>
                <p>
                  Ask me to find flights in plain English. I'll search Google
                  Flights in real time.
                </p>
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

            {/* Loading: typing indicator + skeleton cards */}
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

        {/* Input area */}
        <div className="app-input-area">
          <div className="app-input-chips">
            {/* Suggested queries on empty state */}
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

            {/* Price history chip once we have a route */}
            {priceHistoryRoute && !isEmptyState && (
              <button
                type="button"
                className="app-chip app-chip-accent"
                onClick={openPriceHistory}
              >
                📈 {priceHistoryRoute.departure} →{" "}
                {priceHistoryRoute.arrival} price history
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

      {/* Price History Panel */}
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

// ─── Route form ───────────────────────────────────────────────────────────────

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

// ─── Icons ────────────────────────────────────────────────────────────────────

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

function MenuIcon() {
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
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
