/**
 * Extract the lowest price from a SerpAPI Google Flights result payload for display in price history.
 * Supports best_flights[].price and price_insights.lowest_price.
 */
export function extractLowestPrice(
  payload: Record<string, unknown> | null,
): number | null {
  if (!payload || typeof payload !== 'object') return null;

  const priceInsights = payload.price_insights as
    | { lowest_price?: number }
    | undefined;
  if (
    priceInsights &&
    typeof priceInsights.lowest_price === 'number' &&
    Number.isFinite(priceInsights.lowest_price)
  ) {
    return priceInsights.lowest_price;
  }

  const bestFlights = payload.best_flights as
    | Array<{ price?: number }>
    | undefined;
  if (Array.isArray(bestFlights) && bestFlights.length > 0) {
    const prices = bestFlights
      .map((f) => f?.price)
      .filter((p): p is number => typeof p === 'number' && Number.isFinite(p));
    if (prices.length > 0) return Math.min(...prices);
  }

  const otherFlights = payload.other_flights as
    | Array<{ price?: number }>
    | undefined;
  if (Array.isArray(otherFlights) && otherFlights.length > 0) {
    const prices = otherFlights
      .map((f) => f?.price)
      .filter((p): p is number => typeof p === 'number' && Number.isFinite(p));
    if (prices.length > 0) return Math.min(...prices);
  }

  return null;
}
