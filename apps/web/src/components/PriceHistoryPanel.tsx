import { useEffect, useState } from "react";
import type { PriceHistoryRecord, PriceHistoryResponse } from "../types/price-history";

interface PriceHistoryPanelProps {
  departureId: string;
  arrivalId: string;
  onClose: () => void;
}

export function PriceHistoryPanel({
  departureId,
  arrivalId,
  onClose,
}: PriceHistoryPanelProps) {
  const [data, setData] = useState<PriceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
    });
    const params = new URLSearchParams({
      departure: departureId,
      arrival: arrivalId,
    });
    fetch(`/api/price-history?${params}`)
      .then((res) => res.json() as Promise<PriceHistoryResponse>)
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Failed to load history");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [departureId, arrivalId]);

  const records = data?.records ?? [];

  return (
    <div className="price-history-panel" role="dialog" aria-label="Price history">
      <div className="price-history-header">
        <h3>Price history: {departureId} → {arrivalId}</h3>
        <button type="button" onClick={onClose} aria-label="Close">
          Close
        </button>
      </div>
      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && records.length === 0 && (
        <p>No price history for this route yet. Run a search to save history.</p>
      )}
      {!loading && records.length > 0 && (
        <ul className="price-history-list">
          {records.map((r: PriceHistoryRecord) => (
            <li key={r.id} className="price-history-item">
              <span className="date">
                {r.outboundDate ?? "—"} {r.returnDate ? `→ ${r.returnDate}` : ""}
              </span>
              <span className="searched-at">
                Searched {new Date(r.createdAt).toLocaleString()}
              </span>
              {r.lowestPrice != null && (
                <span className="lowest-price">${r.lowestPrice.toLocaleString()}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
