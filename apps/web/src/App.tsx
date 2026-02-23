import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatResponse, FlightSearchResponse } from "./types/chat";
import type { SessionMessage } from "./types/session";
import { FlightResults } from "./components/FlightResults";
import { MarkdownContent } from "./components/MarkdownContent";
import { PriceHistoryPanel } from "./components/PriceHistoryPanel";
import { SetPriceAlertModal, type AlertTarget } from "./components/SetPriceAlertModal";
import { SkeletonResults } from "./components/SkeletonCard";
import { Sidebar } from "./components/Sidebar";
import { useChatSessions } from "./hooks/useChatSessions";

const SUGGESTED_QUERIES = [
  "Flights from NYC to London next weekend",
  "Cheapest round trip JFK → Paris in March",
  "Direct flights from LAX to Tokyo in April",
  "NYC to Rome, one way, late March",
];

export default function App() {
  const { sessions, activeId, activeSession, newSession, saveSession, switchSession, deleteSession } = useChatSessions();

  const [messages, setMessages]                   = useState<SessionMessage[]>(() => activeSession?.messages ?? []);
  const [priceHistoryRoute, setPriceHistoryRoute] = useState<{ departure: string; arrival: string } | null>(() => activeSession?.priceHistoryRoute ?? null);
  const [input, setInput]                         = useState("");
  const [loading, setLoading]                     = useState(false);
  const [error, setError]                         = useState<string | null>(null);
  const [showPriceHistory, setShowPriceHistory]   = useState(false);
  const [alertTarget, setAlertTarget]             = useState<AlertTarget | null>(null);
  const [sidebarOpen, setSidebarOpen]             = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const prevActiveIdRef = useRef<string | null>(activeId);
  useEffect(() => {
    if (prevActiveIdRef.current === activeId) return;
    prevActiveIdRef.current = activeId;
    setMessages((activeSession?.messages as SessionMessage[]) ?? []);
    setPriceHistoryRoute(activeSession?.priceHistoryRoute ?? null);
    setInput(""); setError(null); setShowPriceHistory(false);
  }, [activeId, activeSession]);

  useEffect(() => { if (!activeId) newSession(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(async (text?: string) => {
    const query = (text ?? input).trim();
    if (!query || loading) return;
    if (!activeId) newSession();

    const userMessage: SessionMessage = { role: "user", content: query };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages); setInput(""); setLoading(true); setError(null);
    setTimeout(() => inputRef.current?.focus(), 0);

    try {
      const res  = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.map(({ role, content }) => ({ role, content })) }),
      });
      const data = (await res.json()) as ChatResponse & { message?: string };
      if (!res.ok) throw new Error(data?.message ?? `Request failed: ${res.status}`);

      const assistantMessage: SessionMessage = {
        role: "assistant", content: data.message, flightResults: data.flightResults ?? null,
      };
      const withReply = [...nextMessages, assistantMessage];
      setMessages(withReply);

      let newRoute = priceHistoryRoute;
      if (data.flightResults) {
        const fr        = data.flightResults as FlightSearchResponse;
        const firstOpt  = fr.best_flights?.[0] ?? fr.other_flights?.[0];
        if (firstOpt) {
          const segs = firstOpt.flights ?? [];
          const dep  = segs[0]?.departure_airport?.id ?? (firstOpt as { departure_airport?: { id?: string } }).departure_airport?.id;
          const arr  = segs[segs.length - 1]?.arrival_airport?.id ?? (firstOpt as { arrival_airport?: { id?: string } }).arrival_airport?.id;
          if (dep && arr) { newRoute = { departure: dep, arrival: arr }; setPriceHistoryRoute(newRoute); }
        }
      }
      saveSession(withReply, newRoute);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, activeId, priceHistoryRoute, newSession, saveSession]);

  const handleNewChat        = useCallback(() => newSession(), [newSession]);
  const handleSwitchSession  = useCallback((id: string) => { switchSession(id); setShowPriceHistory(false); }, [switchSession]);
  const openPriceHistory     = useCallback(() => setShowPriceHistory(true),  []);
  const closePriceHistory    = useCallback(() => setShowPriceHistory(false), []);

  const hasFlightResults = messages.some((m) => m.role === "assistant" && m.flightResults);
  const isEmptyState     = messages.length === 0 && !loading;

  // ── Shared class strings ──
  const chipBase = "px-3 py-[0.35rem] text-[0.78rem] rounded-full border border-app-border bg-app-surface text-app-text-muted cursor-pointer hover:border-app-accent hover:text-app-accent hover:bg-app-accent/15 transition-all whitespace-nowrap";

  return (
    <div className="flex min-h-screen w-full bg-app-bg text-app-text max-[680px]:flex-col">

      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <>
          <div className="hidden max-[680px]:block fixed inset-0 bg-black/50 z-[49]"
            onClick={() => setSidebarOpen(false)} aria-hidden />
          <Sidebar
            sessions={sessions} activeId={activeId}
            onNew={handleNewChat} onSwitch={handleSwitchSession}
            onDelete={deleteSession} onClose={() => setSidebarOpen(false)}
          />
        </>
      )}

      {/* ── Main ── */}
      <main className="flex-1 min-w-0 max-w-[min(960px,96vw)] mx-auto px-5 py-4 pb-6 flex flex-col gap-4 max-[680px]:max-w-full max-[680px]:px-4">

        {/* Header */}
        <header className="flex items-center gap-2.5 pt-3">
          <button type="button" aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            onClick={() => setSidebarOpen((o) => !o)}
            className="shrink-0 flex items-center justify-center w-8 h-8 bg-transparent border-none rounded-md text-app-text-muted cursor-pointer hover:bg-app-border hover:text-app-text transition-colors">
            <MenuIcon />
          </button>
          <div className="flex items-center gap-2 font-bold text-[1.05rem] text-app-text">
            <PlaneSVG />
            <span>Thrifty Traveler</span>
          </div>
          <p className="text-[0.8rem] text-app-text-muted m-0">AI-Powered Flight Search</p>
        </header>

        {/* Chat area */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-4 min-h-[200px] max-h-[68vh] overflow-y-auto p-5 bg-app-surface rounded-2xl border border-app-border scroll-smooth"
            role="log" aria-live="polite">

            {/* Empty state */}
            {isEmptyState && (
              <div className="flex flex-col items-center justify-center text-center gap-3 py-10 flex-1">
                <PlaneSVG large />
                <h2 className="text-[1.3rem] font-bold m-0 text-app-text">Where do you want to go?</h2>
                <p className="text-[0.9rem] text-app-text-muted m-0 max-w-[36ch] leading-relaxed">
                  Ask me to find flights in plain English. I'll search Google Flights in real time.
                </p>
              </div>
            )}

            {/* Messages */}
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col gap-1.5 max-w-[95%] ${m.role === "user" ? "self-end" : "self-start max-w-full"}`}>
                <span className="text-[0.72rem] font-semibold text-app-text-muted uppercase tracking-[0.04em]">
                  {m.role === "user" ? "You" : "Assistant"}
                </span>
                {m.role === "assistant" ? (
                  <>
                    <div className="px-3.5 py-[0.65rem] rounded-[10px] break-words text-[0.93rem] leading-[1.55] bg-app-surface-2 border border-app-border text-app-text">
                      <MarkdownContent content={m.content} />
                    </div>
                    {m.flightResults && (
                      <div className="mt-2 w-full min-w-0">
                        <FlightResults data={m.flightResults} onSetAlert={setAlertTarget} />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="px-3.5 py-[0.65rem] rounded-[10px] break-words text-[0.93rem] leading-[1.55] bg-app-accent text-white">
                    {m.content}
                  </div>
                )}
              </div>
            ))}

            {/* Loading */}
            {loading && (
              <div className="flex flex-col gap-1.5 self-start max-w-full">
                <span className="text-[0.72rem] font-semibold text-app-text-muted uppercase tracking-[0.04em]">Assistant</span>
                <div className="px-3.5 py-[0.65rem] rounded-[10px] flex items-center gap-1.5 text-app-text-muted bg-app-surface-2 border border-app-border text-[0.93rem]">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-app-accent animate-typing typing-dot shrink-0" />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-app-accent animate-typing typing-dot shrink-0" />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-app-accent animate-typing typing-dot shrink-0" />
                  Searching Google Flights…
                </div>
                <div className="mt-2 w-full min-w-0">
                  <SkeletonResults count={3} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center justify-between gap-2 px-3.5 py-[0.65rem] bg-app-red/10 border border-app-red/30 rounded-lg text-[0.875rem] text-app-red" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} aria-label="Dismiss error"
                className="bg-transparent border-none text-app-red cursor-pointer text-xl leading-none p-0 opacity-70 hover:opacity-100">×</button>
            </div>
          )}

          {hasFlightResults && (
            <p className="text-[0.72rem] text-app-text-subtle m-0 leading-snug text-center">
              Prices and availability change frequently. Check the airline or booking site for the latest details before purchasing.
            </p>
          )}
        </div>

        {/* Input area */}
        <div className="shrink-0">
          <div className="flex flex-wrap gap-[0.45rem] mb-[0.65rem]">
            {isEmptyState && SUGGESTED_QUERIES.map((q) => (
              <button key={q} type="button" className={chipBase} onClick={() => sendMessage(q)}>{q}</button>
            ))}
            {priceHistoryRoute && !isEmptyState && (
              <button type="button" onClick={openPriceHistory}
                className={`${chipBase} border-app-accent text-app-accent bg-app-accent/15 hover:bg-app-accent/25`}>
                📈 {priceHistoryRoute.departure} → {priceHistoryRoute.arrival} price history
              </button>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <input
              ref={inputRef} type="text" value={input} disabled={loading}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder={'Ask about flights… e.g. "JFK to CDG next Friday"'}
              aria-label="Message"
              className="flex-1 py-3 px-4 rounded-full border border-app-border bg-app-surface text-app-text text-[0.93rem] transition-colors focus:outline-none focus:border-app-accent disabled:opacity-60 disabled:cursor-not-allowed placeholder:text-app-text-muted"
            />
            <button type="button" onClick={() => sendMessage()} disabled={loading || !input.trim()} aria-label="Send"
              className="shrink-0 w-11 h-11 rounded-full border-none bg-app-accent text-white cursor-pointer flex items-center justify-center hover:bg-app-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <SendIcon />
            </button>
          </div>
        </div>
      </main>

      {/* ── Price Alert Modal ── */}
      {alertTarget && (
        <SetPriceAlertModal target={alertTarget} onClose={() => setAlertTarget(null)} />
      )}

      {/* ── Price History Panel ── */}
      {showPriceHistory && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-10" onClick={closePriceHistory} aria-hidden />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[11] w-[min(560px,94vw)] max-h-[88vh] overflow-y-auto rounded-[14px]">
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
    </div>
  );
}

// ─── Route form ───────────────────────────────────────────────────────────────

function PriceHistoryRouteForm({ onLoad, onClose }: { onLoad: (d: string, a: string) => void; onClose: () => void }) {
  const [dep, setDep] = useState("");
  const [arr, setArr] = useState("");

  const inputCls = "px-[0.9rem] py-[0.6rem] rounded-lg border border-app-border bg-app-surface text-app-text text-[0.9rem] focus:outline-none focus:border-app-accent tracking-[0.08em] font-semibold uppercase placeholder:text-app-text-muted";

  return (
    <div className="bg-[#18181e] border border-app-border rounded-[14px] p-5 flex flex-col gap-4" role="dialog" aria-label="Price history">
      <div className="flex justify-between items-start gap-3">
        <div>
          <h3 className="text-[1.1rem] font-bold m-0">Price history</h3>
          <p className="text-[0.78rem] text-app-text-muted mt-0.5 mb-0">Enter a route to view historical prices</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close"
          className="bg-transparent border-none text-app-text-muted cursor-pointer p-[0.2rem] rounded-md flex items-center justify-center shrink-0 hover:text-app-text hover:bg-app-border transition-colors">
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="flex flex-col gap-2.5 py-1">
        <input type="text" placeholder="Departure (e.g. JFK)" maxLength={3} className={inputCls}
          value={dep} onChange={(e) => setDep(e.target.value.toUpperCase())} />
        <input type="text" placeholder="Arrival (e.g. CDG)" maxLength={3} className={inputCls}
          value={arr} onChange={(e) => setArr(e.target.value.toUpperCase())} />
        <button type="button" disabled={dep.trim().length !== 3 || arr.trim().length !== 3}
          onClick={() => dep.trim().length === 3 && arr.trim().length === 3 && onLoad(dep.trim(), arr.trim())}
          className="px-4 py-2.5 text-[0.875rem] font-semibold rounded-lg border-none bg-app-accent text-white cursor-pointer hover:bg-app-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Load history
        </button>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlaneSVG({ large }: { large?: boolean }) {
  return (
    <svg className={large ? "w-12 h-12 text-app-accent opacity-60" : "w-5 h-5 text-app-accent"}
      viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
