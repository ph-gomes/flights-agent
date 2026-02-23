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

/** Extract HH:MM from a SerpAPI datetime string like "2025-03-01 10:00". */
function extractTime(datetimeStr: string | undefined): string {
  if (!datetimeStr) return "—";
  const parts = datetimeStr.split(" ");
  return parts[parts.length - 1] ?? "—";
}

/** Extract a short date label ("Mar 1") from a SerpAPI datetime string. */
function extractDate(datetimeStr: string | undefined): string {
  if (!datetimeStr) return "";
  const datePart = datetimeStr.split(" ")[0];
  if (!datePart) return "";
  // Parse as local date to avoid UTC-shift artefacts
  const [y, m, d] = datePart.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Returns how many calendar days later the arrival date is relative to the
 * departure date. 0 = same day, 1 = next day, etc.
 */
function daysBetween(
  depDatetime: string | undefined,
  arrDatetime: string | undefined,
): number {
  if (!depDatetime || !arrDatetime) return 0;
  const depPart = depDatetime.split(" ")[0];
  const arrPart = arrDatetime.split(" ")[0];
  if (!depPart || !arrPart || depPart === arrPart) return 0;
  const [dy, dm, dd] = depPart.split("-").map(Number);
  const [ay, am, ad] = arrPart.split("-").map(Number);
  const dep = new Date(dy, (dm ?? 1) - 1, dd ?? 1);
  const arr = new Date(ay, (am ?? 1) - 1, ad ?? 1);
  return Math.round((arr.getTime() - dep.getTime()) / 86_400_000);
}

function stopsLabel(stops: number): string {
  if (stops === 0) return "Nonstop";
  if (stops === 1) return "1 stop";
  return `${stops} stops`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AirlineLogo({ src, alt }: { src?: string; alt: string }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      className="foc-airline-logo"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

function SegmentRow({
  segment,
  layoverAfter,
}: {
  segment: FlightLeg;
  layoverAfter?: LayoverInfo;
}) {
  const depDatetime = segment.departure_airport?.time;
  const arrDatetime = segment.arrival_airport?.time;

  const depTime = extractTime(depDatetime);
  const arrTime = extractTime(arrDatetime);
  const depDate = extractDate(depDatetime);
  const arrDate = extractDate(arrDatetime);
  const extraDays = daysBetween(depDatetime, arrDatetime);

  const depCode = segment.departure_airport?.id ?? "—";
  const arrCode = segment.arrival_airport?.id ?? "—";
  const depName = segment.departure_airport?.name;
  const arrName = segment.arrival_airport?.name;

  return (
    <>
      <div className="foc-segment-row">
        {/* Origin */}
        <div className="foc-seg-endpoint">
          <span className="foc-seg-time">{depTime}</span>
          {depDate && <span className="foc-seg-date">{depDate}</span>}
          <span className="foc-seg-code">{depCode}</span>
          {depName && <span className="foc-seg-name" title={depName}>{depName}</span>}
        </div>

        {/* Line with airline info */}
        <div className="foc-seg-line">
          <div className="foc-seg-line-track">
            <span className="foc-seg-line-dot" />
            <span className="foc-seg-line-bar" />
            <PlaneIcon />
            <span className="foc-seg-line-bar" />
            <span className="foc-seg-line-dot" />
          </div>
          <div className="foc-seg-line-meta">
            {segment.airline_logo && (
              <AirlineLogo src={segment.airline_logo} alt={segment.airline ?? ""} />
            )}
            <span className="foc-seg-flight-num">
              {segment.flight_number ?? segment.airline ?? ""}
            </span>
            {segment.duration != null && (
              <span className="foc-seg-duration">{formatDuration(segment.duration)}</span>
            )}
          </div>
        </div>

        {/* Destination */}
        <div className="foc-seg-endpoint foc-seg-endpoint-right">
          <div className="foc-seg-time-row">
            <span className="foc-seg-time">{arrTime}</span>
            {extraDays > 0 && (
              <span className="foc-next-day" title={arrDate}>
                +{extraDays}
              </span>
            )}
          </div>
          {arrDate && <span className="foc-seg-date">{arrDate}</span>}
          <span className="foc-seg-code">{arrCode}</span>
          {arrName && <span className="foc-seg-name" title={arrName}>{arrName}</span>}
        </div>
      </div>

      {/* Extra segment detail (aircraft, class, legroom) */}
      {(segment.airplane || segment.travel_class || segment.legroom) && (
        <div className="foc-seg-detail">
          {segment.travel_class && <span>{segment.travel_class}</span>}
          {segment.airplane && <span>{segment.airplane}</span>}
          {segment.legroom && (
            <span className="foc-seg-legroom">
              <SeatIcon /> {segment.legroom}
            </span>
          )}
        </div>
      )}

      {/* Layover pill */}
      {layoverAfter && (
        <div className="foc-layover">
          <ClockIcon />
          <span>
            {formatDuration(layoverAfter.duration)} layover ·{" "}
            {layoverAfter.name ?? layoverAfter.id ?? ""}
          </span>
        </div>
      )}
    </>
  );
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────

function PlaneIcon() {
  return (
    <svg className="foc-plane-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
    </svg>
  );
}

function SeatIcon() {
  return (
    <svg className="foc-seat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2v8a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V2" />
      <line x1="6" y1="18" x2="18" y2="18" />
      <line x1="12" y1="14" x2="12" y2="22" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="foc-clock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg className="foc-leaf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function FlightOptionCard({ flight, isCheapest }: FlightOptionCardProps) {
  const segments = flight.flights ?? [];
  const layovers = flight.layovers ?? [];
  const stops = Math.max(0, segments.length - 1);

  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1];

  const originCode = firstSeg?.departure_airport?.id ?? "—";
  const originDatetime = firstSeg?.departure_airport?.time;
  const destDatetime = lastSeg?.arrival_airport?.time;
  const originTime = extractTime(originDatetime);
  const originDate = extractDate(originDatetime);
  const destCode = lastSeg?.arrival_airport?.id ?? "—";
  const destTime = extractTime(destDatetime);
  const destDate = extractDate(destDatetime);
  const routeExtraDays = daysBetween(originDatetime, destDatetime);

  const carrierLogo = flight.airline_logo ?? firstSeg?.airline_logo;
  const carrierName = flight.airline ?? firstSeg?.airline ?? "—";

  const co2Diff = flight.carbon_emissions?.difference_percent;
  const isLowCO2 = co2Diff != null && co2Diff < -5;

  return (
    <article
      className="foc"
      aria-label={`${carrierName} flight, ${stopsLabel(stops)}, ${formatDuration(flight.total_duration)}, ${formatPrice(flight.price)}`}
    >
      {/* ── Badges ── */}
      {(isCheapest || isLowCO2) && (
        <div className="foc-badges">
          {isCheapest && (
            <span className="foc-badge foc-badge-cheapest">Best price</span>
          )}
          {isLowCO2 && (
            <span className="foc-badge foc-badge-eco">
              <LeafIcon /> Low CO₂
            </span>
          )}
        </div>
      )}

      {/* ── Header: carrier + summary stats + price ── */}
      <div className="foc-header">
        <div className="foc-carrier">
          <AirlineLogo src={carrierLogo} alt={carrierName} />
          <span className="foc-carrier-name">{carrierName}</span>
        </div>
        <div className="foc-summary-stats">
          <span className="foc-stops-label" data-nonstop={stops === 0}>
            {stopsLabel(stops)}
          </span>
          <span className="foc-dot-sep" aria-hidden>·</span>
          <span className="foc-total-duration">{formatDuration(flight.total_duration)}</span>
          {flight.type && (
            <>
              <span className="foc-dot-sep" aria-hidden>·</span>
              <span className="foc-trip-type">{flight.type}</span>
            </>
          )}
        </div>
        <div className="foc-price-block">
          <span className="foc-price">{formatPrice(flight.price)}</span>
          <span className="foc-price-qualifier">per person</span>
        </div>
      </div>

      {/* ── Quick route bar (origin → destination) ── */}
      <div className="foc-quick-route">
        <div className="foc-quick-route-origin">
          <span className="foc-quick-time">{originTime}</span>
          {originDate && <span className="foc-quick-date">{originDate}</span>}
          <span className="foc-quick-code">{originCode}</span>
        </div>
        <div className="foc-quick-route-line" aria-hidden>
          {stops > 0 && (
            <div className="foc-quick-stops">
              {Array.from({ length: stops }).map((_, i) => (
                <span
                  key={i}
                  className="foc-quick-stop-dot"
                  title={layovers[i]?.name ?? layovers[i]?.id}
                />
              ))}
            </div>
          )}
        </div>
        <div className="foc-quick-route-dest">
          <div className="foc-quick-time-row">
            <span className="foc-quick-time">{destTime}</span>
            {routeExtraDays > 0 && (
              <span className="foc-next-day" title={destDate || undefined}>
                +{routeExtraDays}
              </span>
            )}
          </div>
          {destDate && <span className="foc-quick-date">{destDate}</span>}
          <span className="foc-quick-code">{destCode}</span>
        </div>
      </div>

      {/* ── Expanded segment details ── */}
      {segments.length > 0 && (
        <details className="foc-details">
          <summary className="foc-details-toggle">
            {segments.length === 1 ? "Flight details" : `${segments.length} flights · ${stops} ${stops === 1 ? "stop" : "stops"}`}
          </summary>
          <div className="foc-details-body">
            {segments.map((seg, i) => (
              <SegmentRow
                key={i}
                segment={seg}
                layoverAfter={layovers[i]}
              />
            ))}
          </div>
        </details>
      )}

      {/* ── CO₂ note ── */}
      {co2Diff != null && (
        <div className={`foc-co2 ${co2Diff < 0 ? "foc-co2-good" : "foc-co2-bad"}`}>
          <LeafIcon />
          {co2Diff < 0
            ? `${Math.abs(co2Diff)}% less CO₂ than typical`
            : `${co2Diff}% more CO₂ than typical`}
        </div>
      )}

      {/* ── Actions ── */}
      <div className="foc-actions">
        <button type="button" className="foc-btn-primary">
          Select flight
        </button>
      </div>
    </article>
  );
}
