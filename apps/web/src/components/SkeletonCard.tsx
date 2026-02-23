export function SkeletonCard() {
  return (
    <div
      className="border-b border-app-border bg-app-surface-2 pointer-events-none last:border-b-0"
      aria-hidden="true"
    >
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="skel-block w-[120px] h-4 shrink-0" />
        <div className="skel-block w-[100px] h-3.5 flex-1" />
        <div className="skel-block w-[60px] h-5 shrink-0" />
      </div>
      <div className="flex items-center gap-2 px-4 pb-3">
        <div className="skel-block w-12 h-9 shrink-0" />
        <div className="flex-1 h-px bg-app-border" />
        <div className="skel-block w-12 h-9 shrink-0" />
      </div>
      <div className="flex justify-end px-4 pb-3">
        <div className="skel-block w-[100px] h-8" />
      </div>
    </div>
  );
}

export function SkeletonResults({ count = 3 }: { count?: number }) {
  return (
    <section className="pt-2" aria-label="Loading flights">
      <div className="mb-3">
        <div className="skel-block w-[140px] h-4" />
      </div>
      <div className="flex flex-col border border-app-border rounded-xl overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </section>
  );
}
