import { useState, useCallback } from "react";
import type { FlightSearchResponse, FlightOption } from "../types/chat";
import { FlightOptionCard } from "./FlightOptionCard";
import type { AlertTarget } from "./SetPriceAlertModal";
import { SkeletonResults } from "./SkeletonCard";
import {
  formatPrice,
  formatDuration,
  formatFlightDate,
  formatTimeFromDateTime,
} from "../utils/formatters";

export interface RoundTripSelection {
  selectedOutbound: FlightOption | null;
  returnOptions: FlightSearchResponse | null;
  selectedReturn: FlightOption | null;
}

interface FlightResultsProps {
  data: FlightSearchResponse | null | undefined;
  returnDate?: string;
  /** Outbound route (from → to); used for return-options API as return leg (to → from). */
  outboundRoute?: { departure: string; arrival: string } | null;
  onSetAlert?: (target: AlertTarget) => void;
  /** Restored selection state from session (round-trip only). */
  initialSelection?: RoundTripSelection | null;
  /** Called whenever the round-trip selection changes so the parent can persist it. */
  onSelectionChange?: (selection: RoundTripSelection) => void;
}

/** One-line summary for a flight leg (e.g. "JFK → MIA · Mar 1 · 10:00 – 13:05 · 3h 5m") */
function flightLegSummary(flight: FlightOption): string {
  const segs = flight.flights ?? [];
  const first = segs[0];
  const last = segs[segs.length - 1];
  const depTime = first?.departure_airport?.time?.trim();
  const arrTime = last?.arrival_airport?.time?.trim();
  const depId = first?.departure_airport?.id ?? "—";
  const arrId = last?.arrival_airport?.id ?? "—";
  const dateStr = depTime
    ? formatFlightDate(depTime.split(" ")[0] ?? "", {
        month: "short",
        day: "numeric",
      })
    : "";
  const timeDep = formatTimeFromDateTime(depTime);
  const timeArr = formatTimeFromDateTime(arrTime);
  const dur = formatDuration(flight.total_duration ?? undefined);
  return `${depId} → ${arrId} · ${dateStr} · ${timeDep} – ${timeArr}${dur !== "—" ? ` · ${dur}` : ""}`;
}

const priceLevelClasses: Record<string, string> = {
  "low prices": "bg-app-green/15 text-app-green",
  "typical prices": "bg-app-yellow/[0.12] text-app-yellow",
  "high prices": "bg-app-red/[0.12] text-app-red",
};

function FlightCardList({
  flights,
  lowestPrice,
  onSetAlert,
  onSelectOutbound,
  onSelectFlight,
  max = 10,
}: {
  flights: FlightOption[];
  lowestPrice: number | undefined;
  onSetAlert?: (target: AlertTarget) => void;
  onSelectOutbound?: (flight: FlightOption) => void;
  onSelectFlight?: (flight: FlightOption) => void;
  max?: number;
}) {
  return (
    <div className="flex flex-col border border-app-border rounded-xl overflow-hidden">
      {flights.slice(0, max).map((flight, i) => (
        <FlightOptionCard
          key={i}
          flight={flight}
          isCheapest={
            lowestPrice != null &&
            flight.price != null &&
            Number.isFinite(flight.price) &&
            flight.price === lowestPrice
          }
          onSetAlert={onSetAlert}
          onSelectOutbound={
            onSelectOutbound ? () => onSelectOutbound(flight) : undefined
          }
          onSelectFlight={
            onSelectFlight ? () => onSelectFlight(flight) : undefined
          }
        />
      ))}
    </div>
  );
}

export function FlightResults({
  data,
  returnDate,
  outboundRoute,
  onSetAlert,
  initialSelection,
  onSelectionChange,
}: FlightResultsProps) {
  const [showOther, setShowOther] = useState(false);
  const [selectedOutbound, setSelectedOutbound] = useState<FlightOption | null>(
    () => initialSelection?.selectedOutbound ?? null,
  );
  const [returnOptions, setReturnOptions] =
    useState<FlightSearchResponse | null>(
      () => initialSelection?.returnOptions ?? null,
    );
  const [loadingReturn, setLoadingReturn] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<FlightOption | null>(
    () => initialSelection?.selectedReturn ?? null,
  );
  const [returnOptionError, setReturnOptionError] = useState<string | null>(
    null,
  );

  // Notify parent whenever the three pieces of selection state change together.
  const notifyChange = useCallback(
    (
      outbound: FlightOption | null,
      options: FlightSearchResponse | null,
      ret: FlightOption | null,
    ) => {
      onSelectionChange?.({
        selectedOutbound: outbound,
        returnOptions: options,
        selectedReturn: ret,
      });
    },
    [onSelectionChange],
  );

  const clearSelection = useCallback(() => {
    setSelectedOutbound(null);
    setReturnOptions(null);
    setSelectedReturn(null);
    notifyChange(null, null, null);
  }, [notifyChange]);

  const loadReturnOptions = useCallback(
    async (flight: FlightOption) => {
      // SerpAPI requires the exact departure_token from the outbound result (include base64 padding if present)
      const token =
        typeof flight.departure_token === "string"
          ? flight.departure_token.trim()
          : undefined;
      if (!returnDate) return;
      if (!token) {
        setReturnOptionError(
          "Return options aren't available for this option. Try another outbound flight.",
        );
        setTimeout(() => setReturnOptionError(null), 5000);
        return;
      }
      setReturnOptionError(null);
      setSelectedOutbound(flight);
      setReturnOptions(null);
      setSelectedReturn(null);
      notifyChange(flight, null, null);
      setLoadingReturn(true);
      try {
        const outboundDate =
          flight.flights?.[0]?.departure_airport?.time?.trim().split(" ")[0] ||
          undefined;
        if (!outboundDate) {
          setReturnOptionError(
            "Could not determine outbound date from this flight.",
          );
          setTimeout(() => setReturnOptionError(null), 5000);
          setLoadingReturn(false);
          return;
        }
        const params = new URLSearchParams();
        params.set("departure_token", token);
        params.set("return_date", returnDate);
        params.set("outbound_date", outboundDate);
        // SerpAPI expects the same route as the initial search (origin → destination), not the return leg
        if (outboundRoute?.departure && outboundRoute?.arrival) {
          params.set("departure_id", outboundRoute.departure);
          params.set("arrival_id", outboundRoute.arrival);
        }
        params.set("hl", "en");
        params.set("gl", "us");
        params.set("currency", "USD");
        const url = `/api/flight-search/search?${params.toString()}`;
        const res = await fetch(url);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            (data as { message?: string })?.message ||
            `Failed to load return options (${res.status})`;
          setReturnOptionError(msg);
          setTimeout(() => setReturnOptionError(null), 6000);
          setReturnOptions(null);
          return;
        }
        const options = data as FlightSearchResponse;
        setReturnOptions(options);
        notifyChange(flight, options, null);
      } catch (err) {
        setReturnOptions(null);
        setReturnOptionError(
          err instanceof Error ? err.message : "Failed to load return options",
        );
        setTimeout(() => setReturnOptionError(null), 6000);
      } finally {
        setLoadingReturn(false);
      }
    },
    [returnDate, outboundRoute, notifyChange],
  );

  if (!data) return null;

  const best: FlightOption[] = data.best_flights ?? [];
  const other: FlightOption[] = data.other_flights ?? [];
  const all = best.length > 0 ? best : other;
  const hasBoth = best.length > 0 && other.length > 0;
  if (all.length === 0) return null;

  const isOutboundMode = Boolean(returnDate);
  const outboundSelectHandler = isOutboundMode ? loadReturnOptions : undefined;

  const lowestFromInsights = data.price_insights?.lowest_price;
  const allForPrice = [...best, ...other];
  const prices = allForPrice
    .map((f) => f.price)
    .filter((p): p is number => p != null && Number.isFinite(p));
  const lowestPrice =
    lowestFromInsights != null && Number.isFinite(lowestFromInsights)
      ? lowestFromInsights
      : prices.length > 0
        ? Math.min(...prices)
        : undefined;

  const priceLevel = data.price_insights?.price_level;
  const priceLevelKey = priceLevel?.toLowerCase() ?? "";

  return (
    <section className="pt-2" aria-label="Flight options">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <h3 className="text-[0.9rem] font-semibold text-app-text m-0">
          {isOutboundMode
            ? `Outbound flights — ${allForPrice.length} option${allForPrice.length !== 1 ? "s" : ""}. Select one to see return flights`
            : `${allForPrice.length} flight${allForPrice.length !== 1 ? "s" : ""} found`}
        </h3>
        <div className="flex items-center gap-2 text-[0.82rem]">
          {lowestPrice != null && (
            <span className="text-app-text-muted">
              From{" "}
              <strong className="text-app-green font-bold">
                {formatPrice(lowestPrice)}
              </strong>
            </span>
          )}
          {priceLevel && (
            <span
              className={`px-2 py-0.5 rounded-full text-[0.75rem] font-semibold ${priceLevelClasses[priceLevelKey] ?? ""}`}
            >
              {priceLevel}
            </span>
          )}
        </div>
      </div>

      {/* Outbound list: hide when an outbound is selected so focus is on return flights */}
      {!(isOutboundMode && selectedOutbound) && (
        <>
          {/* Best flights (or all if no "best" vs "other" split) */}
          {best.length > 0 && (
            <>
              {best.length > 1 && !isOutboundMode && (
                <p className="text-[0.75rem] text-app-text-muted mb-2 font-medium">
                  Best options
                </p>
              )}
              <FlightCardList
                flights={best}
                lowestPrice={lowestPrice}
                onSetAlert={onSetAlert}
                onSelectOutbound={outboundSelectHandler}
              />
            </>
          )}

          {/* Other flights: accordion / "View X more" */}
          {hasBoth && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowOther((v) => !v)}
                className="w-full py-2.5 px-3 rounded-lg border border-app-border bg-app-surface text-app-text-muted text-[0.82rem] font-medium hover:bg-app-surface-2 hover:text-app-text transition-colors flex items-center justify-center gap-2"
                aria-expanded={showOther}
              >
                {showOther ? (
                  "Hide extra options"
                ) : (
                  <>
                    View {other.length} more option
                    {other.length !== 1 ? "s" : ""}
                  </>
                )}
              </button>
              {showOther && (
                <div className="mt-2">
                  <FlightCardList
                    flights={other}
                    lowestPrice={lowestPrice}
                    onSetAlert={onSetAlert}
                    onSelectOutbound={outboundSelectHandler}
                  />
                </div>
              )}
            </div>
          )}

          {/* Only other_flights (no best): show as main list */}
          {best.length === 0 && other.length > 0 && (
            <FlightCardList
              flights={other}
              lowestPrice={lowestPrice}
              onSetAlert={onSetAlert}
              onSelectOutbound={outboundSelectHandler}
            />
          )}
        </>
      )}

      {/* Error when outbound has no departure_token */}
      {isOutboundMode && returnOptionError && (
        <div className="mt-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-[0.82rem] text-amber-200">
          {returnOptionError}
        </div>
      )}

      {/* Return flights (step 2): show as soon as user selects outbound */}
      {isOutboundMode && selectedOutbound && (
        <div className="mt-4 pt-4 border-t border-app-border">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <h4 className="text-[0.9rem] font-semibold text-app-text m-0">
              Return flights
            </h4>
            <button
              type="button"
              onClick={clearSelection}
              className="text-[0.8rem] font-medium text-app-text-muted hover:text-app-accent"
            >
              Change outbound
            </button>
          </div>
          {loadingReturn && (
            <div className="rounded-xl border border-app-border bg-app-surface/50 px-4 py-6 text-center">
              <p className="text-app-text-muted text-[0.9rem] font-medium m-0 mb-3">
                Fetching return flights…
              </p>
              <SkeletonResults />
            </div>
          )}
          {!loadingReturn && returnOptions && (
            <>
              {selectedReturn ? (
                <div className="rounded-xl border-2 border-app-accent bg-app-accent/10 overflow-hidden">
                  <div className="px-4 py-3 border-b border-app-accent/20 bg-app-accent/5">
                    <h5 className="text-[0.95rem] font-bold text-app-accent m-0">
                      Your round trip
                    </h5>
                    <p className="text-[0.75rem] text-app-text-muted m-0 mt-0.5">
                      Both flights selected
                    </p>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-app-text-muted">
                          Outbound
                        </span>
                      </div>
                      <p className="text-[0.88rem] text-app-text m-0 font-medium">
                        {flightLegSummary(selectedOutbound)}
                      </p>
                      {selectedOutbound.flights?.[0]?.airline && (
                        <p className="text-[0.78rem] text-app-text-muted m-0">
                          {selectedOutbound.flights?.[0]?.airline}
                        </p>
                      )}
                    </div>
                    <div className="h-px bg-app-border" />
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-app-text-muted">
                          Return
                        </span>
                      </div>
                      <p className="text-[0.88rem] text-app-text m-0 font-medium">
                        {flightLegSummary(selectedReturn)}
                      </p>
                      {selectedReturn.flights?.[0]?.airline && (
                        <p className="text-[0.78rem] text-app-text-muted m-0">
                          {selectedReturn.flights?.[0]?.airline}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <p className="text-[0.9rem] font-bold text-app-text m-0">
                        Total
                      </p>
                      <p className="text-[1rem] font-bold text-app-accent m-0">
                        {formatPrice(selectedReturn.price)}
                      </p>
                    </div>
                  </div>
                  <div className="px-4 py-2.5 flex flex-wrap gap-2 border-t border-app-accent/20 bg-app-surface/50">
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="text-[0.8rem] font-medium text-app-text-muted hover:text-app-accent"
                    >
                      Change outbound
                    </button>
                    <span className="text-app-border">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReturn(null);
                        notifyChange(selectedOutbound, returnOptions, null);
                      }}
                      className="text-[0.8rem] font-medium text-app-text-muted hover:text-app-accent"
                    >
                      Change return
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {(() => {
                    const retBest = returnOptions.best_flights ?? [];
                    const retOther = returnOptions.other_flights ?? [];
                    const retAll = [...retBest, ...retOther];
                    if (retAll.length === 0) {
                      const msg =
                        (returnOptions as { error?: string })?.error ??
                        "No return flights returned for this selection. Try another outbound flight or dates.";
                      return (
                        <div className="rounded-xl border border-app-border bg-app-surface/50 px-4 py-4 text-[0.9rem] text-app-text-muted">
                          {msg}
                        </div>
                      );
                    }
                    const retPrices = retAll
                      .map((f) => f.price)
                      .filter(
                        (p): p is number => p != null && Number.isFinite(p),
                      );
                    const retLowest =
                      retPrices.length > 0 ? Math.min(...retPrices) : undefined;
                    return (
                      <div className="flex flex-col border border-app-border rounded-xl overflow-hidden">
                        {retBest.map((flight, i) => (
                          <FlightOptionCard
                            key={`best-${i}`}
                            flight={flight}
                            isCheapest={
                              retLowest != null &&
                              flight.price != null &&
                              flight.price === retLowest
                            }
                            onSetAlert={onSetAlert}
                            onSelectFlight={() => {
                              setSelectedReturn(flight);
                              notifyChange(
                                selectedOutbound,
                                returnOptions,
                                flight,
                              );
                            }}
                          />
                        ))}
                        {retOther.map((flight, i) => (
                          <FlightOptionCard
                            key={`other-${i}`}
                            flight={flight}
                            isCheapest={
                              retLowest != null &&
                              flight.price != null &&
                              flight.price === retLowest
                            }
                            onSetAlert={onSetAlert}
                            onSelectFlight={() => {
                              setSelectedReturn(flight);
                              notifyChange(
                                selectedOutbound,
                                returnOptions,
                                flight,
                              );
                            }}
                          />
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
