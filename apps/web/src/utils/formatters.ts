/**
 * Shared formatters for price, duration, and dates across the app.
 */

export function formatPrice(price: number | undefined | null): string {
  if (price == null || !Number.isFinite(price)) return "—";
  return `$${price.toLocaleString()}`;
}

export function formatDuration(minutes: number | undefined | null): string {
  if (minutes == null || !Number.isFinite(minutes)) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Format a date string (YYYY-MM-DD or ISO) for display. */
export function formatFlightDate(
  dateStr: string,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string {
  const safe = dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr;
  return new Date(safe).toLocaleDateString("en-US", opts);
}

/** Extract time part from "YYYY-MM-DD HH:mm" or similar. */
export function formatTimeFromDateTime(dt: string | undefined): string {
  return dt ? (dt.split(" ").pop() ?? "—") : "—";
}

/** Relative label for sidebar: "2:30 PM", "Yesterday", "3 days ago", or "Mar 1". */
export function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays === 0)
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
