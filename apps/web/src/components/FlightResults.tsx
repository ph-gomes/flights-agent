import { useState, useCallback } from "react";
import type { FlightSearchResponse, FlightOption } from "../types/chat";
import { FlightOptionCard } from "./FlightOptionCard";
import type { AlertTarget } from "./SetPriceAlertModal";
import { SkeletonResults } from "./SkeletonCard";

interface FlightResultsProps {
  data: FlightSearchResponse | null | undefined;
  returnDate?: string;
  onSetAlert?: (target: AlertTarget) => void;
}

function formatPrice(price: number | undefined) {
  if (price == null || !Number.isFinite(price)) return "—";
  return `$${price.toLocaleString()}`;
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
  max = 10,
}: {
  flights: FlightOption[];
  lowestPrice: number | undefined;
  onSetAlert?: (target: AlertTarget) => void;
  onSelectOutbound?: (flight: FlightOption) => void;
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
        />
      ))}
    </div>
  );
}

export function FlightResults({
  data,
  returnDate,
  onSetAlert,
}: FlightResultsProps) {
  const [showOther, setShowOther] = useState(false);
  const [selectedOutbound, setSelectedOutbound] = useState<FlightOption | null>(
    null,
  );
  const [returnOptions, setReturnOptions] =
    useState<FlightSearchResponse | null>(null);
  const [loadingReturn, setLoadingReturn] = useState(false);

  const loadReturnOptions = useCallback(
    async (flight: FlightOption) => {
      const token = flight.departure_token;
      if (!token || !returnDate) return;
      setSelectedOutbound(flight);
      setReturnOptions(null);
      setLoadingReturn(true);
      try {
        const params = new URLSearchParams({
          departure_token: token,
          return_date: returnDate,
        });
        const res = await fetch(`/api/flight-search/return-options?${params}`);
        if (!res.ok) throw new Error("Failed to load return options");
        const json = (await res.json()) as FlightSearchResponse;
        setReturnOptions(json);
      } catch {
        setReturnOptions(null);
      } finally {
        setLoadingReturn(false);
      }
    },
    [returnDate],
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
              <>View {other.length} more option{other.length !== 1 ? "s" : ""}</>
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

      {/* Return flights (step 2) */}
      {isOutboundMode && selectedOutbound && (
        <div className="mt-4 pt-4 border-t border-app-border">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <h4 className="text-[0.9rem] font-semibold text-app-text m-0">
              Return flights
            </h4>
            <button
              type="button"
              onClick={() => {
                setSelectedOutbound(null);
                setReturnOptions(null);
              }}
              className="text-[0.8rem] font-medium text-app-text-muted hover:text-app-accent"
            >
              Change outbound
            </button>
          </div>
          {loadingReturn && <SkeletonResults />}
          {!loadingReturn && returnOptions && (
            <FlightResults
              data={returnOptions}
              onSetAlert={onSetAlert}
            />
          )}
        </div>
      )}
    </section>
  );
}
