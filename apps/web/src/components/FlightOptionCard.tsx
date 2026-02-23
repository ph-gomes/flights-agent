import { useState } from "react";
import type { FlightOption, FlightLeg, LayoverInfo } from "../types/chat";
import type { AlertTarget } from "./SetPriceAlertModal";
import {
  formatPrice,
  formatDuration,
  formatFlightDate,
  formatTimeFromDateTime,
} from "../utils/formatters";

export interface FlightOptionCardProps {
  flight: FlightOption;
  isCheapest?: boolean;
  onSetAlert?: (target: AlertTarget) => void;
  /** When set and flight has departure_token, shows "Select outbound" for return-options flow. */
  onSelectOutbound?: () => void;
  /** When set, enables "Select return flight" (or "Select flight") to complete round-trip choice. */
  onSelectFlight?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractDate(dt: string | undefined): string {
  if (!dt) return "";
  return formatFlightDate(dt.split(" ")[0] ?? "", {
    month: "short",
    day: "numeric",
  });
}

function daysBetween(dep?: string, arr?: string) {
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

function stopsLabel(n: number) {
  if (n === 0) return "Nonstop";
  if (n === 1) return "1 stop";
  return `${n} stops`;
}

// ─── Airline logo ─────────────────────────────────────────────────────────────

function AirlineLogo({ src, alt }: { src?: string; alt: string }) {
  if (!src) return <div className="w-7 h-7 shrink-0" aria-hidden />;
  return (
    <img
      src={src}
      alt={alt}
      className="w-7 h-7 object-contain rounded-[5px] shrink-0"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
}

// ─── Segment timeline ─────────────────────────────────────────────────────────

function SegmentTimeline({
  segment,
  layoverAfter,
}: {
  segment: FlightLeg;
  layoverAfter?: LayoverInfo;
}) {
  const dep = segment.departure_airport?.time;
  const arr = segment.arrival_airport?.time;
  const extraDays = daysBetween(dep, arr);

  return (
    <>
      {/* 3-col grid: time | node | info */}
      <div className="grid grid-cols-[54px_20px_1fr]">
        {/* Departure */}
        <div className="flex flex-col items-end gap-[0.05rem] pt-0.5 pr-2">
          <span className="text-[0.82rem] font-bold text-app-text whitespace-nowrap">
            {formatTimeFromDateTime(dep)}
          </span>
          <span className="text-[0.65rem] text-app-text-muted">
            {extractDate(dep)}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="w-2 h-2 rounded-full border-2 border-app-accent bg-app-bg shrink-0 mt-0.5" />
          <span className="flex-1 w-0.5 bg-app-border min-h-6" />
        </div>
        <div className="flex flex-col gap-[0.05rem] pl-2 pb-2">
          <span className="text-[0.82rem] font-bold text-app-text">
            {segment.departure_airport?.id}
          </span>
          {segment.departure_airport?.name && (
            <span className="text-[0.7rem] text-app-text-muted">
              {segment.departure_airport.name}
            </span>
          )}
        </div>

        {/* Flight meta (middle) */}
        <div className="min-h-[0.35rem]" />
        <div className="flex flex-col items-center">
          <span className="flex-1 w-0.5 bg-app-border min-h-6" />
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.72rem] text-app-text-muted pl-2 py-0.5">
          {segment.airline_logo && (
            <img
              src={segment.airline_logo}
              alt=""
              className="w-3.5 h-3.5 object-contain rounded-sm shrink-0"
              onError={(e) =>
                ((e.currentTarget as HTMLImageElement).style.display = "none")
              }
            />
          )}
          {segment.flight_number && (
            <span className="font-semibold text-app-text">
              {segment.flight_number}
            </span>
          )}
          {segment.travel_class && <span>· {segment.travel_class}</span>}
          {segment.airplane && <span>· {segment.airplane}</span>}
          {segment.duration != null && (
            <span>· {formatDuration(segment.duration)}</span>
          )}
          {segment.legroom && <span>· {segment.legroom}</span>}
        </div>

        {/* Arrival */}
        <div className="flex flex-col items-end gap-[0.05rem] pt-0.5 pr-2">
          <span className="text-[0.82rem] font-bold text-app-text whitespace-nowrap">
            {formatTimeFromDateTime(arr)}
            {extraDays > 0 && (
              <sup className="text-[0.58rem] font-bold text-app-accent align-super ml-0.5">
                +{extraDays}
              </sup>
            )}
          </span>
          <span className="text-[0.65rem] text-app-text-muted">
            {extractDate(arr)}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="w-2 h-2 rounded-full border-2 border-app-accent bg-app-bg shrink-0 mt-0.5" />
        </div>
        <div className="flex flex-col gap-[0.05rem] pl-2 pb-2">
          <span className="text-[0.82rem] font-bold text-app-text">
            {segment.arrival_airport?.id}
          </span>
          {segment.arrival_airport?.name && (
            <span className="text-[0.7rem] text-app-text-muted">
              {segment.arrival_airport.name}
            </span>
          )}
        </div>
      </div>

      {/* Layover pill */}
      {layoverAfter && (
        <div className="flex items-center gap-1.5 my-0.5 ml-[74px] px-2.5 py-[0.3rem] bg-app-accent/[0.06] border border-app-accent/20 rounded-md text-[0.72rem] text-app-text-muted">
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
      className={`w-[18px] h-[18px] text-app-text-muted transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
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
      className="w-3 h-3 text-app-accent shrink-0"
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
      className="w-3 h-3 shrink-0"
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

function ArrowRightIcon() {
  return (
    <svg
      className="w-4 h-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FlightOptionCard({
  flight,
  isCheapest,
  onSetAlert,
  onSelectOutbound,
  onSelectFlight,
}: FlightOptionCardProps) {
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
  const routeExtraDays = daysBetween(originDatetime, destDatetime);

  const carrierLogo = flight.airline_logo ?? firstSeg?.airline_logo;
  const carrierName = flight.airline ?? firstSeg?.airline ?? "—";

  const co2Diff = flight.carbon_emissions?.difference_percent;
  const isLowCO2 = co2Diff != null && co2Diff < -5;

  return (
    <article
      className={`border-b border-app-border bg-app-surface-2 last:border-b-0 transition-[background] duration-[0.12s] ${expanded ? "" : "hover:bg-[#252530]"}`}
    >
      {/* ── Summary row ──
           Using <div role="button"> instead of <button> because this row can
           contain "Select outbound / Select return" <button> elements, and
           nested <button> inside <button> is invalid HTML. */}
      <div
        role="button"
        tabIndex={0}
        className={`flex items-center w-full px-4 py-3 max-[620px]:px-3 max-[620px]:py-[0.65rem] cursor-pointer text-left transition-[background] duration-[0.12s] hover:bg-white/[0.03] ${expanded ? "bg-app-accent/[0.06]" : ""}`}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        aria-expanded={expanded}
        aria-label={`${carrierName}, ${stopsLabel(stops)}, ${formatDuration(flight.total_duration)}, ${formatPrice(flight.price)}. Click to ${expanded ? "collapse" : "expand"} details.`}
      >
        {/* Airline */}
        <div className="flex flex-none w-[150px] max-[620px]:w-[120px] flex-row items-center gap-2 min-w-0 shrink-0">
          <AirlineLogo src={carrierLogo} alt={carrierName} />
          <span className="text-[0.82rem] font-semibold text-app-text whitespace-nowrap overflow-hidden text-ellipsis">
            {carrierName}
          </span>
        </div>

        {/* Times */}
        <div className="flex flex-col flex-none w-[140px] max-[620px]:w-[110px] justify-center gap-[0.15rem] shrink-0">
          <div className="flex items-baseline gap-1">
            <span className="text-[0.9rem] font-bold text-app-text whitespace-nowrap">
              {formatTimeFromDateTime(originDatetime)}
            </span>
            <span className="text-[0.75rem] text-app-text-subtle" aria-hidden>
              —
            </span>
            <span className="text-[0.9rem] font-bold text-app-text whitespace-nowrap">
              {formatTimeFromDateTime(destDatetime)}
              {routeExtraDays > 0 && (
                <sup className="text-[0.58rem] font-bold text-app-accent align-super ml-0.5">
                  +{routeExtraDays}
                </sup>
              )}
            </span>
          </div>
          <div className="flex gap-5 text-[0.68rem] text-app-text-muted">
            <span>{originCode}</span>
            <span>{destCode}</span>
          </div>
        </div>

        {/* Duration */}
        <div className="flex flex-col flex-none w-[76px] max-[620px]:w-[60px] justify-center gap-[0.15rem] shrink-0">
          <span className="text-[0.82rem] font-medium text-app-text">
            {formatDuration(flight.total_duration)}
          </span>
          <span className="text-[0.68rem] text-app-text-muted">
            {originCode}–{destCode}
          </span>
        </div>

        {/* Stops */}
        <div className="flex flex-col flex-none w-[72px] justify-center gap-[0.15rem] shrink-0 max-[620px]:hidden">
          <span
            className={`text-[0.82rem] ${stops === 0 ? "text-app-green font-semibold" : "text-app-text-muted"}`}
          >
            {stopsLabel(stops)}
          </span>
        </div>

        {/* CO₂ */}
        <div className="flex flex-col flex-1 min-w-0 justify-center gap-[0.15rem] max-[620px]:hidden">
          {co2Diff != null && (
            <span
              className={`text-[0.72rem] whitespace-nowrap ${isLowCO2 ? "text-[#4ade80] bg-[rgba(74,222,128,0.1)] px-1.5 py-0.5 rounded self-start" : "text-app-text-muted"}`}
            >
              {co2Diff < 0 ? `−${Math.abs(co2Diff)}%` : `+${co2Diff}%`} CO₂
            </span>
          )}
        </div>

        {/* Price */}
        <div className="flex flex-col flex-none w-[90px] items-end text-right justify-center gap-[0.15rem] shrink-0">
          {isCheapest && (
            <span className="text-[0.62rem] font-bold text-app-green tracking-[0.04em] uppercase">
              Best price
            </span>
          )}
          <span className="text-[1rem] font-extrabold text-app-text whitespace-nowrap">
            {formatPrice(flight.price)}
          </span>
          {flight.type && (
            <span className="text-[0.65rem] text-app-text-muted">
              {flight.type.toLowerCase()}
            </span>
          )}
        </div>

        {onSelectOutbound && (
          <div className="flex flex-none items-center shrink-0 ml-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectOutbound();
              }}
              className={
                isCheapest
                  ? "inline-flex items-center gap-2 px-4 py-2.5 text-[0.8rem] font-bold rounded-xl border-0 bg-app-accent text-white cursor-pointer whitespace-nowrap transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-app-accent focus:ring-offset-2 focus:ring-offset-app-bg"
                  : "inline-flex items-center gap-2 px-4 py-2.5 text-[0.8rem] font-semibold rounded-xl border-2 border-app-accent bg-app-accent/10 text-app-accent cursor-pointer whitespace-nowrap transition-all hover:bg-app-accent hover:text-white focus:outline-none focus:ring-2 focus:ring-app-accent focus:ring-offset-2 focus:ring-offset-app-bg"
              }
              aria-label={`Select this outbound flight${flight.price != null ? ` for ${formatPrice(flight.price)}` : ""}`}
            >
              <span>Select outbound</span>
              <ArrowRightIcon />
            </button>
          </div>
        )}

        {/* Select return flight (round-trip step 2) */}
        {onSelectFlight && (
          <div className="flex flex-none items-center shrink-0 ml-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectFlight();
              }}
              className={
                isCheapest
                  ? "inline-flex items-center gap-2 px-4 py-2.5 text-[0.8rem] font-bold rounded-xl border-0 bg-app-green text-app-bg cursor-pointer whitespace-nowrap transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-app-green focus:ring-offset-2 focus:ring-offset-app-bg"
                  : "inline-flex items-center gap-2 px-4 py-2.5 text-[0.8rem] font-semibold rounded-xl border-2 border-app-green bg-app-green/15 text-app-green cursor-pointer whitespace-nowrap transition-all hover:bg-app-green hover:text-app-bg focus:outline-none focus:ring-2 focus:ring-app-green focus:ring-offset-2 focus:ring-offset-app-bg"
              }
              aria-label={`Select this return flight${flight.price != null ? ` for ${formatPrice(flight.price)}` : ""}`}
            >
              <span>Select return</span>
              <CheckIcon />
            </button>
          </div>
        )}

        {/* Chevron */}
        <div
          className="flex flex-col flex-none w-7 items-end justify-center shrink-0"
          aria-hidden
        >
          <ChevronIcon open={expanded} />
        </div>
      </div>

      {/* ── Expanded detail panel ── */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-app-border-sub bg-black/[0.12]">
          <div className="pt-[0.85rem] flex flex-col gap-0">
            {segments.map((seg, i) => (
              <SegmentTimeline
                key={i}
                segment={seg}
                layoverAfter={layovers[i]}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between flex-wrap gap-2 mt-3 pt-[0.65rem] border-t border-app-border-sub">
            {co2Diff != null && (
              <div
                className={`flex items-center gap-1.5 text-[0.72rem] ${co2Diff < 0 ? "text-[#4ade80]" : "text-app-text-muted"}`}
              >
                <LeafIcon />
                {co2Diff < 0
                  ? `${Math.abs(co2Diff)}% less CO₂ than typical for this route`
                  : `${Math.abs(co2Diff)}% more CO₂ than typical for this route`}
              </div>
            )}
            <div className="flex gap-2 ml-auto">
              {onSetAlert && (
                <button
                  type="button"
                  className="px-4 py-2 text-[0.8rem] font-semibold rounded-lg border border-app-border bg-transparent text-app-text-muted cursor-pointer whitespace-nowrap transition-all hover:border-app-accent hover:text-app-accent hover:bg-app-accent/15"
                  onClick={() =>
                    onSetAlert({
                      departureId: originCode === "—" ? "" : originCode,
                      arrivalId: destCode === "—" ? "" : destCode,
                      outboundDate: originDatetime?.split(" ")[0] ?? "",
                      currentPrice: flight.price,
                    })
                  }
                >
                  🔔 Set Alert
                </button>
              )}
              {onSelectFlight && (
                <button
                  type="button"
                  onClick={onSelectFlight}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-[0.85rem] font-semibold rounded-xl border-2 border-app-green bg-app-green/15 text-app-green cursor-pointer shrink-0 transition-all hover:bg-app-green hover:text-app-bg focus:outline-none focus:ring-2 focus:ring-app-green focus:ring-offset-2 focus:ring-offset-app-bg"
                >
                  <span>Select return</span>
                  <CheckIcon />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
