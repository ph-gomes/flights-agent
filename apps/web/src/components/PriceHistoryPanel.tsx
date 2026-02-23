import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { PriceHistoryRecord, PriceHistoryResponse } from "../types/price-history";

interface PriceHistoryPanelProps {
  departureId: string;
  arrivalId: string;
  onClose: () => void;
}

interface ChartPoint {
  /** ISO date string used for sorting ("2026-03-15") */
  date: string;
  price: number;
  /** Human-readable X-axis label ("Mar 15") */
  label: string;
  /** Full date for tooltip ("Mar 15, 2026") */
  fullLabel: string;
}

function formatPrice(price: number): string {
  return `$${price.toLocaleString()}`;
}

/**
 * Formats a date-only string ("2026-03-15") or ISO timestamp as a short label.
 * Adds "T00:00:00" so Date() doesn't apply a UTC offset and shift the day.
 */
function formatFlightDate(dateStr: string, opts: Intl.DateTimeFormatOptions): string {
  const safe = dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr;
  return new Date(safe).toLocaleDateString("en-US", opts);
}

/**
 * Builds one chart point per unique outboundDate.
 * When the same departure date was searched multiple times, keeps the
 * most-recent search so the price reflects the current market.
 * Falls back to createdAt if outboundDate is missing.
 */
function buildChartData(records: PriceHistoryRecord[]): ChartPoint[] {
  const byDate = new Map<string, PriceHistoryRecord>();

  for (const r of records) {
    if (r.lowestPrice == null) continue;
    const key = r.outboundDate ?? r.createdAt.slice(0, 10);
    const existing = byDate.get(key);
    // Keep the most recently performed search for this flight date
    if (!existing || r.createdAt > existing.createdAt) {
      byDate.set(key, r);
    }
  }

  return Array.from(byDate.entries())
    .map(([dateKey, r]) => ({
      date: dateKey,
      price: r.lowestPrice as number,
      label: formatFlightDate(dateKey, { month: "short", day: "numeric" }),
      fullLabel: formatFlightDate(dateKey, { month: "short", day: "numeric", year: "numeric" }),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  return (
    <div className="ph-tooltip">
      <p className="ph-tooltip-date">Departs {point.payload.fullLabel}</p>
      <p className="ph-tooltip-price">{formatPrice(point.value)}</p>
    </div>
  );
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
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      departure: departureId,
      arrival: arrivalId,
    });

    fetch(`/api/price-history?${params}`)
      .then((res) => res.json() as Promise<PriceHistoryResponse>)
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load history");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [departureId, arrivalId]);

  const records = data?.records ?? [];
  const chartData = buildChartData(records);

  const prices = chartData.map((d) => d.price);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const avgPrice = prices.length
    ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    : null;

  return (
    <div className="price-history-panel" role="dialog" aria-label="Price history">
      {/* Header */}
      <div className="price-history-header">
        <div className="ph-header-title">
          <h3>
            {departureId}
            <span className="ph-arrow">→</span>
            {arrivalId}
          </h3>
          <p className="ph-subtitle">Lowest fare found · by departure date</p>
        </div>
        <button
          type="button"
          className="ph-close-btn"
          onClick={onClose}
          aria-label="Close price history"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      {loading && (
        <div className="ph-loading">
          <div className="ph-loading-bar" />
          <p>Loading price history…</p>
        </div>
      )}

      {error && <p className="error ph-error">{error}</p>}

      {!loading && !error && records.length === 0 && (
        <div className="ph-empty">
          <p>No price history for this route yet.</p>
          <p className="ph-empty-hint">
            Search for flights on this route and come back to track how prices change.
          </p>
        </div>
      )}

      {!loading && chartData.length > 0 && (
        <>
          {/* Stats row */}
          <div className="ph-stats">
            <div className="ph-stat">
              <span className="ph-stat-label">Lowest</span>
              <span className="ph-stat-value ph-stat-low">
                {minPrice != null ? formatPrice(minPrice) : "—"}
              </span>
            </div>
            <div className="ph-stat">
              <span className="ph-stat-label">Average</span>
              <span className="ph-stat-value">
                {avgPrice != null ? formatPrice(avgPrice) : "—"}
              </span>
            </div>
            <div className="ph-stat">
              <span className="ph-stat-label">Highest</span>
              <span className="ph-stat-value ph-stat-high">
                {maxPrice != null ? formatPrice(maxPrice) : "—"}
              </span>
            </div>
            <div className="ph-stat">
              <span className="ph-stat-label">Dates</span>
              <span className="ph-stat-value">{chartData.length}</span>
            </div>
          </div>

          {/* Chart */}
          <div className="ph-chart-wrapper">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#a1a1aa", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#a1a1aa", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${v}`}
                  width={52}
                />
                <Tooltip content={<CustomTooltip />} />
                {avgPrice != null && (
                  <ReferenceLine
                    y={avgPrice}
                    stroke="#a78bfa"
                    strokeDasharray="4 2"
                    strokeOpacity={0.5}
                    label={{
                      value: "avg",
                      fill: "#a1a1aa",
                      fontSize: 10,
                      position: "insideTopRight",
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  fill="url(#priceGradient)"
                  dot={{ r: 3, fill: "#a78bfa", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#8b5cf6", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Raw records list */}
          <details className="ph-records-details">
            <summary className="ph-records-toggle">
              Show all {records.length} search{records.length !== 1 ? "es" : ""}
            </summary>
            <ul className="price-history-list">
              {records.map((r: PriceHistoryRecord) => (
                <li key={r.id} className="price-history-item">
                  <span className="date">
                    {r.outboundDate ?? "—"}
                    {r.returnDate ? ` → ${r.returnDate}` : ""}
                  </span>
                  <span className="searched-at">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                  {r.lowestPrice != null && (
                    <span className="lowest-price">{formatPrice(r.lowestPrice)}</span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
