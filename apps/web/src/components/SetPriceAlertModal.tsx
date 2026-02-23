import { useState, useEffect } from "react";
import { usePriceAlerts } from "../hooks/usePriceAlerts";
import { formatPrice } from "../utils/formatters";

export interface AlertTarget {
  departureId: string;
  arrivalId: string;
  outboundDate: string;
  currentPrice?: number;
}

interface SetPriceAlertModalProps {
  target: AlertTarget;
  onClose: () => void;
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

export function SetPriceAlertModal({
  target,
  onClose,
}: SetPriceAlertModalProps) {
  const { creating, success, error, createAlert, reset } = usePriceAlerts();

  const [email, setEmail] = useState("");
  const [targetPrice, setTargetPrice] = useState(
    target.currentPrice ? String(Math.floor(target.currentPrice * 0.9)) : "",
  );

  useEffect(() => reset, [reset]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(targetPrice);
    if (!email || !price || price <= 0) return;
    await createAlert({
      departureId: target.departureId,
      arrivalId: target.arrivalId,
      outboundDate: target.outboundDate,
      targetPrice: price,
      email,
    });
  }

  const inputCls =
    "w-full px-[0.9rem] py-[0.6rem] rounded-lg border border-app-border bg-app-surface text-app-text text-[0.9rem] transition-colors focus:outline-none focus:border-app-accent placeholder:text-app-text-muted";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-10"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[11] w-[min(480px,94vw)] max-h-[88vh] overflow-y-auto rounded-[14px]">
        <div
          className="bg-[#18181e] border border-app-border rounded-[14px] p-5 flex flex-col gap-4"
          role="dialog"
          aria-label="Set price alert"
        >
          {/* Header */}
          <div className="flex justify-between items-start gap-3">
            <div>
              <h3 className="text-[1.1rem] font-bold m-0">
                🔔 Set Price Alert
              </h3>
              <p className="text-[0.78rem] text-app-text-muted mt-0.5 mb-0">
                {target.departureId} → {target.arrivalId} ·{" "}
                {target.outboundDate}
                {target.currentPrice != null && (
                  <>
                    {" "}
                    · currently{" "}
                    <strong className="text-app-text">
                      {formatPrice(target.currentPrice)}
                    </strong>
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="bg-transparent border-none text-app-text-muted cursor-pointer p-[0.2rem] rounded-md flex items-center justify-center shrink-0 hover:text-app-text hover:bg-app-border transition-colors"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Success */}
          {success ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-app-green/15 text-app-green text-xl font-bold">
                ✓
              </span>
              <p className="text-[0.9rem] text-app-text-muted max-w-[32ch] leading-relaxed m-0">
                Alert set! We'll notify{" "}
                <strong className="text-app-text">{email}</strong> when the
                price drops to{" "}
                <strong className="text-app-text">
                  {formatPrice(Number(targetPrice))}
                </strong>{" "}
                or below.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-[0.875rem] font-semibold rounded-lg border-none bg-app-accent text-white cursor-pointer hover:bg-app-accent-hover transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.8rem] font-semibold text-app-text-muted uppercase tracking-[0.04em]">
                  Notify me at
                </span>
                <input
                  type="email"
                  className={inputCls}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[0.8rem] font-semibold text-app-text-muted uppercase tracking-[0.04em]">
                  When price drops to or below
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[1rem] font-bold text-app-text-muted">
                    $
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className={`${inputCls} flex-1`}
                    placeholder="e.g. 350"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    required
                  />
                </div>
              </label>

              {error && (
                <p className="text-app-red text-[0.9rem] m-0">{error}</p>
              )}

              <button
                type="submit"
                disabled={creating || !email || !targetPrice}
                className="px-4 py-2.5 text-[0.875rem] font-semibold rounded-lg border-none bg-app-accent text-white cursor-pointer hover:bg-app-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creating ? "Saving…" : "Set Alert"}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
