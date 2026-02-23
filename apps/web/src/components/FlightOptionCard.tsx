import { useState } from "react";
import type { FlightOption, FlightLeg, LayoverInfo } from "../types/chat";

export interface FlightOptionCardProps {
  flight: FlightOption;
  isCheapest?: boolean;
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

function formatPrice(price: number | undefined): string {
  if (price == null || !Number.isFinite(price)) return "—";
  return `$${price.toLocaleString()}`;
}

function formatDuration(minutes: number | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function extractTime(datetimeStr: string | undefined): string {
  if (!datetimeStr) return "—";
  return datetimeStr.split(" ").pop() ?? "—";
}

function extractDate(datetimeStr: string | undefined): string {
  if (!datetimeStr) return "";
  const datePart = datetimeStr.split(" ")[0];
  if (!datePart) return "";
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function daysBetween(dep?: string, arr?: string): number {
  if (!dep || !arr) return 0;
  const dp = dep.split(" ")[0];
  const ap = arr.split(" ")[0];
  if (!dp || !ap || dp === ap) return 0;
  const [dy, dm, dd] = dp.split("-").map(Number);
  const [ay, am, ad] = ap.split("-").map(Number);
  return Math.round(
    (new Date(ay, (am ?? 1) - 1, ad ?? 1).getTime() -
      new Date(dy, (dm ?? 1) - 1, dd ?? 1).getTime()) /
      86_400_000,
  );
}

function stopsLabel(stops: number): string {
  if (stops === 0) return "Nonstop";
  if (stops === 1) return "1 stop";
  return `${stops} stops`;
}

// ─── Airline logo ────────────────────────────────────────────────────────────

function AirlineLogo({ src, alt }: { src?: string; alt: string }) {
  if (!src) return <div className="foc-logo-placeholder" aria-hidden />;
  return (
    <img
      src={src}
      alt={alt}
      className="foc-logo"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
}

// ─── Expanded segment timeline ───────────────────────────────────────────────

function SegmentTimeline({
  segment,
  layoverAfter,
}: {
  segment: FlightLeg;
  layoverAfter?: LayoverInfo;
}) {
  const depDatetime = segment.departure_airport?.time;
  const arrDatetime = segment.arrival_airport?.time;
  const extraDays = daysBetween(depDatetime, arrDatetime);

  return (
    <>
      <div className="foc-tl">
        {/* Departure row */}
        <div className="foc-tl-time">
          <span className="foc-tl-clock">{extractTime(depDatetime)}</span>
          <span className="foc-tl-date">{extractDate(depDatetime)}</span>
        </div>
        <div className="foc-tl-node">
          <span className="foc-tl-dot" />
          <span className="foc-tl-line" />
        </div>
        <div className="foc-tl-place">
          <span className="foc-tl-code">{segment.departure_airport?.id}</span>
          {segment.departure_airport?.name && (
            <span className="foc-tl-name">{segment.departure_airport.name}</span>
          )}
        </div>

        {/* Flight info row (middle of the line) */}
        <div className="foc-tl-spacer" />
        <div className="foc-tl-node foc-tl-node-mid">
          <span className="foc-tl-line" />
        </div>
        <div className="foc-tl-meta">
          {segment.airline_logo && (
            <img
              src={segment.airline_logo}
              alt=""
              className="foc-tl-seg-logo"
              onError={(e) =>
                ((e.currentTarget as HTMLImageElement).style.display = "none")
              }
            />
          )}
          {segment.flight_number && (
            <span className="foc-tl-flightnum">{segment.flight_number}</span>
          )}
          {segment.travel_class && <span>· {segment.travel_class}</span>}
          {segment.airplane && <span>· {segment.airplane}</span>}
          {segment.duration != null && (
            <span>· {formatDuration(segment.duration)}</span>
          )}
          {segment.legroom && <span>· {segment.legroom}</span>}
        </div>

        {/* Arrival row */}
        <div className="foc-tl-time">
          <span className="foc-tl-clock">
            {extractTime(arrDatetime)}
            {extraDays > 0 && (
              <sup className="foc-next-day">+{extraDays}</sup>
            )}
          </span>
          <span className="foc-tl-date">{extractDate(arrDatetime)}</span>
        </div>
        <div className="foc-tl-node foc-tl-node-last">
          <span className="foc-tl-dot" />
        </div>
        <div className="foc-tl-place">
          <span className="foc-tl-code">{segment.arrival_airport?.id}</span>
          {segment.arrival_airport?.name && (
            <span className="foc-tl-name">{segment.arrival_airport.name}</span>
          )}
        </div>
      </div>

      {/* Layover pill */}
      {layoverAfter && (
        <div className="foc-tl-layover">
          <ClockIcon />
          <span>
            {formatDuration(layoverAfter.duration)} layover ·{" "}
            {layoverAfter.name ?? layoverAfter.id}
          </span>
        </div>
      )}
    </>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`foc-chevron ${open ? "foc-chevron-open" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      className="foc-clock-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg
      className="foc-leaf-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function FlightOptionCard({ flight, isCheapest }: FlightOptionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const segments = flight.flights ?? [];
  const layovers = flight.layovers ?? [];
  const stops = Math.max(0, segments.length - 1);

  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1];

  const originDatetime = firstSeg?.departure_airport?.time;
  const destDatetime = lastSeg?.arrival_airport?.time;
  const originCode = firstSeg?.departure_airport?.id ?? "—";
  const destCode = lastSeg?.arrival_airport?.id ?? "—";
  const originTime = extractTime(originDatetime);
  const destTime = extractTime(destDatetime);
  const routeExtraDays = daysBetween(originDatetime, destDatetime);

  const carrierLogo = flight.airline_logo ?? firstSeg?.airline_logo;
  const carrierName = flight.airline ?? firstSeg?.airline ?? "—";

  const co2Diff = flight.carbon_emissions?.difference_percent;
  const isLowCO2 = co2Diff != null && co2Diff < -5;

  return (
    <article className={`foc ${expanded ? "foc-open" : ""}`}>
      {/* ── Compact summary row (always visible, fully clickable) ── */}
      <button
        type="button"
        className="foc-row"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={`${carrierName}, ${stopsLabel(stops)}, ${formatDuration(flight.total_duration)}, ${formatPrice(flight.price)}. Click to ${expanded ? "collapse" : "expand"} details.`}
      >
        {/* Airline logo + name */}
        <div className="foc-col foc-col-airline">
          <AirlineLogo src={carrierLogo} alt={carrierName} />
          <span className="foc-carrier-name">{carrierName}</span>
        </div>

        {/* Departure — Arrival times */}
        <div className="foc-col foc-col-times">
          <div className="foc-times">
            <span className="foc-t">{originTime}</span>
            <span className="foc-dash" aria-hidden>
              —
            </span>
            <span className="foc-t">
              {destTime}
              {routeExtraDays > 0 && (
                <sup className="foc-next-day">+{routeExtraDays}</sup>
              )}
            </span>
          </div>
          <div className="foc-codes">
            <span>{originCode}</span>
            <span>{destCode}</span>
          </div>
        </div>

        {/* Duration */}
        <div className="foc-col foc-col-duration">
          <span className="foc-dur">{formatDuration(flight.total_duration)}</span>
          <span className="foc-route-label">
            {originCode}–{destCode}
          </span>
        </div>

        {/* Stops */}
        <div className="foc-col foc-col-stops">
          <span className={`foc-stops-val ${stops === 0 ? "foc-nonstop" : ""}`}>
            {stopsLabel(stops)}
          </span>
        </div>

        {/* CO₂ emissions */}
        <div className="foc-col foc-col-co2">
          {co2Diff != null && (
            <span className={`foc-co2-val ${isLowCO2 ? "foc-co2-low" : ""}`}>
              {co2Diff < 0 ? `−${Math.abs(co2Diff)}%` : `+${co2Diff}%`} CO₂
            </span>
          )}
        </div>

        {/* Price + best badge */}
        <div className="foc-col foc-col-price">
          {isCheapest && <span className="foc-best-tag">Best price</span>}
          <span className="foc-price">{formatPrice(flight.price)}</span>
          {flight.type && (
            <span className="foc-price-type">{flight.type.toLowerCase()}</span>
          )}
        </div>

        {/* Expand chevron */}
        <div className="foc-col foc-col-chevron" aria-hidden>
          <ChevronIcon open={expanded} />
        </div>
      </button>

      {/* ── Expanded detail panel ── */}
      {expanded && (
        <div className="foc-panel">
          <div className="foc-panel-segments">
            {segments.map((seg, i) => (
              <SegmentTimeline
                key={i}
                segment={seg}
                layoverAfter={layovers[i]}
              />
            ))}
          </div>

          <div className="foc-panel-footer">
            {co2Diff != null && (
              <div
                className={`foc-co2-note ${co2Diff < 0 ? "foc-co2-note-good" : ""}`}
              >
                <LeafIcon />
                {co2Diff < 0
                  ? `${Math.abs(co2Diff)}% less CO₂ than typical for this route`
                  : `${Math.abs(co2Diff)}% more CO₂ than typical for this route`}
              </div>
            )}
            <button type="button" className="foc-select-btn">
              Select flight
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
