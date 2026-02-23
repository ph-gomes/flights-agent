/**
 * Skeleton loader shown while the AI agent is fetching flight results.
 * Animates with a shimmer effect matching the FlightOptionCard layout.
 */
export function SkeletonCard() {
  return (
    <div className="foc foc-skeleton" aria-hidden="true">
      <div className="foc-header">
        <div className="skel-block skel-airline" />
        <div className="skel-block skel-stats" />
        <div className="skel-block skel-price" />
      </div>
      <div className="foc-quick-route">
        <div className="skel-block skel-time" />
        <div className="skel-line-placeholder" />
        <div className="skel-block skel-time" />
      </div>
      <div className="foc-actions">
        <div className="skel-block skel-btn" />
      </div>
    </div>
  );
}

export function SkeletonResults({ count = 3 }: { count?: number }) {
  return (
    <section className="flight-results" aria-label="Loading flights">
      <div className="flight-results-meta">
        <div className="skel-block skel-title" />
      </div>
      <div className="flight-cards">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </section>
  );
}
