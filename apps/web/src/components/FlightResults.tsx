import type { FlightSearchResponse, FlightOption } from "../types/chat";

interface FlightResultsProps {
  data: FlightSearchResponse | null | undefined;
}

function formatPrice(price: number | undefined): string {
  if (price == null || !Number.isFinite(price)) return "—";
  return `$${price.toLocaleString()}`;
}

function routeLabel(flight: FlightOption): string {
  const from = flight.departure_airport?.name ?? "—";
  const to = flight.arrival_airport?.name ?? "—";
  return `${from} → ${to}`;
}

export function FlightResults({ data }: FlightResultsProps) {
  if (!data) return null;

  const best = data.best_flights ?? [];
  const other = data.other_flights ?? [];
  const all = best.length > 0 ? best : other;
  if (all.length === 0) return null;

  const lowestPrice = data.price_insights?.lowest_price;

  return (
    <section className="flight-results" aria-label="Flight options">
      <h3>Flight options</h3>
      {lowestPrice != null && Number.isFinite(lowestPrice) && (
        <p className="flight-results-summary">
          Lowest from search: <strong>{formatPrice(lowestPrice)}</strong>
        </p>
      )}
      <ul className="flight-list">
        {all.slice(0, 10).map((flight, i) => (
          <li key={i} className="flight-card">
            <div className="flight-card-route" title={routeLabel(flight)}>
              {routeLabel(flight)}
            </div>
            <div className="flight-card-header">
              <span className="flight-airline">{flight.airline ?? "—"}</span>
              <span className="flight-price">{formatPrice(flight.price)}</span>
            </div>
            <div className="flight-card-body">
              {flight.outbound_duration && (
                <span className="flight-detail">Outbound: {flight.outbound_duration}</span>
              )}
              {flight.return_duration && (
                <span className="flight-detail">Return: {flight.return_duration}</span>
              )}
              {flight.flights?.length ? (
                <div className="flight-legs">
                  {flight.flights.map((leg, j) => (
                    <span key={j} className="flight-leg">
                      {leg.departure_airport?.name ?? "—"} → {leg.arrival_airport?.name ?? "—"}
                      {leg.duration != null ? ` (${leg.duration}m)` : ""}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
