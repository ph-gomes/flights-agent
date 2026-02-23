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
import type {
  PriceHistoryRecord,
  PriceHistoryResponse,
} from "../types/price-history";

interface PriceHistoryPanelProps {
  departureId: string;
  arrivalId: string;
  onClose: () => void;
}

interface ChartPoint {
  date: string;
  price: number;
  label: string;
  fullLabel: string;
}

function formatPrice(price: number) {
  return `$${price.toLocaleString()}`;
}

function formatFlightDate(dateStr: string, opts: Intl.DateTimeFormatOptions) {
  const safe = dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr;
  return new Date(safe).toLocaleDateString("en-US", opts);
}

function buildChartData(records: PriceHistoryRecord[]): ChartPoint[] {
  const byDate = new Map<string, PriceHistoryRecord>();
  for (const r of records) {
    if (r.lowestPrice == null) continue;
    const key = r.outboundDate ?? r.createdAt.slice(0, 10);
    const existing = byDate.get(key);
    if (!existing || r.createdAt > existing.createdAt) byDate.set(key, r);
  }
  return Array.from(byDate.entries())
    .map(([dateKey, r]) => ({
      date: dateKey,
      price: r.lowestPrice as number,
      label: formatFlightDate(dateKey, { month: "short", day: "numeric" }),
      fullLabel: formatFlightDate(dateKey, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  return (
    <div className="bg-[#1e1e26] border border-app-border rounded-lg px-3 py-2 text-[0.8rem]">
      <p className="text-app-text-muted mb-1 mt-0">
        Departs {point.payload.fullLabel}
      </p>
      <p className="text-app-accent font-bold m-0 text-[0.95rem]">
        {formatPrice(point.value)}
      </p>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      className="w-[18px] h-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
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

    const fetchData = async () => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
        try {
          const params = new URLSearchParams({
            departure: departureId,
            arrival: arrivalId,
          });
          const response = await fetch(`/api/price-history?${params}`);
          const body = (await response.json()) as PriceHistoryResponse;
          if (!cancelled) setData(body);
        } catch (err: unknown) {
          if (!cancelled)
            setError(err instanceof Error ? err.message : "Failed to load");
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
    };

    fetchData();
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
    <div
      className="bg-[#18181e] border border-app-border rounded-[14px] p-5 flex flex-col gap-4"
      role="dialog"
      aria-label="Price history"
    >
      {/* Header */}
      <div className="flex justify-between items-start gap-3">
        <div>
          <h3 className="text-[1.1rem] font-bold m-0 flex items-center gap-1">
            {departureId}
            <span className="text-app-accent text-[1rem]">→</span>
            {arrivalId}
          </h3>
          <p className="text-[0.78rem] text-app-text-muted mt-0.5 mb-0">
            Lowest fare found · by departure date
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close price history"
          className="bg-transparent border-none text-app-text-muted cursor-pointer p-[0.2rem] rounded-md flex items-center justify-center shrink-0 hover:text-app-text hover:bg-app-border transition-colors"
        >
          <CloseIcon />
        </button>
      </div>

      {/* States */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-6 text-app-text-muted text-[0.85rem]">
          <div
            className="w-full h-[3px] rounded-sm animate-shimmer"
            style={{
              background:
                "linear-gradient(90deg, transparent, var(--color-app-accent), transparent)",
              backgroundSize: "200% 100%",
            }}
          />
          <p className="m-0">Loading price history…</p>
        </div>
      )}

      {error && <p className="text-app-red text-[0.9rem] m-0">{error}</p>}

      {!loading && !error && records.length === 0 && (
        <div className="text-center py-6 text-app-text-muted text-[0.875rem]">
          <p className="m-0 mb-1.5">No price history for this route yet.</p>
          <p className="m-0 text-[0.78rem] opacity-70">
            Search for flights on this route and come back to track how prices
            change.
          </p>
        </div>
      )}

      {!loading && chartData.length > 0 && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              {
                label: "Lowest",
                value: minPrice != null ? formatPrice(minPrice) : "—",
                cls: "text-app-green",
              },
              {
                label: "Average",
                value: avgPrice != null ? formatPrice(avgPrice) : "—",
                cls: "",
              },
              {
                label: "Highest",
                value: maxPrice != null ? formatPrice(maxPrice) : "—",
                cls: "text-app-text-muted",
              },
              { label: "Dates", value: String(chartData.length), cls: "" },
            ].map(({ label, value, cls }) => (
              <div
                key={label}
                className="flex flex-col gap-[0.15rem] px-3 py-[0.6rem] bg-app-surface rounded-lg border border-app-border"
              >
                <span className="text-[0.68rem] text-app-text-muted uppercase tracking-[0.05em]">
                  {label}
                </span>
                <span
                  className={`text-[0.95rem] font-bold text-app-text ${cls}`}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="rounded-lg overflow-hidden">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="priceGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
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

          {/* Raw records */}
          <details className="mt-1">
            <summary className="text-[0.78rem] text-app-accent cursor-pointer list-none py-1 select-none [&::-webkit-details-marker]:hidden">
              Show all {records.length} search{records.length !== 1 ? "es" : ""}
            </summary>
            <ul className="list-none p-0 mt-2 m-0 flex flex-col gap-0">
              {records.map((r: PriceHistoryRecord) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 py-[0.45rem] border-b border-app-border-sub text-[0.82rem] flex-wrap last:border-b-0"
                >
                  <span className="font-medium text-app-text min-w-0">
                    {r.outboundDate ?? "—"}
                    {r.returnDate ? ` → ${r.returnDate}` : ""}
                  </span>
                  <span className="text-app-text-muted text-[0.75rem] flex-1">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                  {r.lowestPrice != null && (
                    <span className="font-bold text-app-green ml-auto shrink-0">
                      {formatPrice(r.lowestPrice)}
                    </span>
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
