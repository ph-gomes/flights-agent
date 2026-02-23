import type { FlightSearchResponse, FlightOption } from "../types/chat";
import { FlightOptionCard } from "./FlightOptionCard";
import type { AlertTarget } from "./SetPriceAlertModal";

interface FlightResultsProps {
  data: FlightSearchResponse | null | undefined;
  onSetAlert?: (target: AlertTarget) => void;
}

function formatPrice(price: number | undefined) {
  if (price == null || !Number.isFinite(price)) return "—";
  return `$${price.toLocaleString()}`;
}

const priceLevelClasses: Record<string, string> = {
  "low prices":     "bg-app-green/15 text-app-green",
  "typical prices": "bg-app-yellow/[0.12] text-app-yellow",
  "high prices":    "bg-app-red/[0.12] text-app-red",
};

export function FlightResults({ data, onSetAlert }: FlightResultsProps) {
  if (!data) return null;

  const best: FlightOption[]  = data.best_flights  ?? [];
  const other: FlightOption[] = data.other_flights ?? [];
  const all = best.length > 0 ? best : other;
  if (all.length === 0) return null;

  const lowestFromInsights = data.price_insights?.lowest_price;
  const prices = all.map((f) => f.price).filter((p): p is number => p != null && Number.isFinite(p));
  const lowestPrice =
    lowestFromInsights != null && Number.isFinite(lowestFromInsights)
      ? lowestFromInsights
      : prices.length > 0 ? Math.min(...prices) : undefined;

  const priceLevel = data.price_insights?.price_level;
  const priceLevelKey = priceLevel?.toLowerCase() ?? "";

  return (
    <section className="pt-2" aria-label="Flight options">
      {/* Meta row */}
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <h3 className="text-[0.9rem] font-semibold text-app-text m-0">
          {all.length} flight{all.length !== 1 ? "s" : ""} found
        </h3>
        <div className="flex items-center gap-2 text-[0.82rem]">
          {lowestPrice != null && (
            <span className="text-app-text-muted">
              From <strong className="text-app-green font-bold">{formatPrice(lowestPrice)}</strong>
            </span>
          )}
          {priceLevel && (
            <span className={`px-2 py-0.5 rounded-full text-[0.75rem] font-semibold ${priceLevelClasses[priceLevelKey] ?? ""}`}>
              {priceLevel}
            </span>
          )}
        </div>
      </div>

      {/* Cards list */}
      <div className="flex flex-col border border-app-border rounded-xl overflow-hidden">
        {all.slice(0, 10).map((flight, i) => (
          <FlightOptionCard
            key={i}
            flight={flight}
            isCheapest={lowestPrice != null && flight.price != null && Number.isFinite(flight.price) && flight.price === lowestPrice}
            onSetAlert={onSetAlert}
          />
        ))}
      </div>
    </section>
  );
}
