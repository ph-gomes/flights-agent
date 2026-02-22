import type { FlightSearchResponse } from "../types/chat";

interface FlightResultsProps {
  data: FlightSearchResponse | null | undefined;
}

function formatPrice(price: number | undefined): string {
  if (price == null || !Number.isFinite(price)) return "—";
  return `$${price.toLocaleString()}`;
}

export function FlightResults({ data }: FlightResultsProps) {
  if (!data) return null;

  const best = data.best_flights ?? [];
  const other = data.other_flights ?? [];
  const all = best.length > 0 ? best : other;
  if (all.length === 0) return null;

  return (
    <section className="flight-results" aria-label="Flight options">
      <h3>Flight options</h3>
      <ul className="flight-list">
        {all.slice(0, 10).map((flight, i) => (
          <li key={i} className="flight-card">
            <div className="flight-card-header">
              <span className="flight-airline">{flight.airline ?? "—"}</span>
              <span className="flight-price">{formatPrice(flight.price)}</span>
            </div>
            <div className="flight-card-body">
              {flight.departure_airport?.name && (
                <span>From {flight.departure_airport.name}</span>
              )}
              {flight.arrival_airport?.name && (
                <span>To {flight.arrival_airport.name}</span>
              )}
              {flight.outbound_duration && (
                <span>Outbound: {flight.outbound_duration}</span>
              )}
              {flight.return_duration && (
                <span>Return: {flight.return_duration}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
