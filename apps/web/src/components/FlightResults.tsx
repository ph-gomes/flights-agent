import type { FlightSearchResponse, FlightOption } from "../types/chat";
import { FlightOptionCard } from "./FlightOptionCard";
import type { AlertTarget } from "./SetPriceAlertModal";

interface FlightResultsProps {
  data: FlightSearchResponse | null | undefined;
  onSetAlert?: (target: AlertTarget) => void;
}

function formatPrice(price: number | undefined): string {
  if (price == null || !Number.isFinite(price)) return "—";
  return `$${price.toLocaleString()}`;
}

export function FlightResults({ data, onSetAlert }: FlightResultsProps) {
  if (!data) return null;

  const best: FlightOption[] = data.best_flights ?? [];
  const other: FlightOption[] = data.other_flights ?? [];
  const all = best.length > 0 ? best : other;
  if (all.length === 0) return null;

  const lowestFromInsights = data.price_insights?.lowest_price;
  const prices = all
    .map((f) => f.price)
    .filter((p): p is number => p != null && Number.isFinite(p));
  const lowestPrice =
    lowestFromInsights != null && Number.isFinite(lowestFromInsights)
      ? lowestFromInsights
      : prices.length > 0
        ? Math.min(...prices)
        : undefined;

  const priceLevel = data.price_insights?.price_level;

  return (
    <section className="flight-results" aria-label="Flight options">
      <div className="flight-results-meta">
        <h3 className="flight-results-title">
          {all.length} flight{all.length !== 1 ? "s" : ""} found
        </h3>
        <div className="flight-results-insights">
          {lowestPrice != null && Number.isFinite(lowestPrice) && (
            <span className="flight-results-lowest">
              From <strong>{formatPrice(lowestPrice)}</strong>
            </span>
          )}
          {priceLevel && (
            <span
              className={`flight-results-price-level frl-${priceLevel.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {priceLevel}
            </span>
          )}
        </div>
      </div>

      <div className="flight-cards">
        {all.slice(0, 10).map((flight, i) => (
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
          />
        ))}
      </div>
    </section>
  );
}
