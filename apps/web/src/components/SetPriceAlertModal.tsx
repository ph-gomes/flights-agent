import { useState, useEffect } from "react";
import { usePriceAlerts } from "../hooks/usePriceAlerts";

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

export function SetPriceAlertModal({ target, onClose }: SetPriceAlertModalProps) {
  const { creating, success, error, createAlert, reset } = usePriceAlerts();

  const [email, setEmail] = useState("");
  const [targetPrice, setTargetPrice] = useState(
    target.currentPrice ? String(Math.floor(target.currentPrice * 0.9)) : "",
  );

  // Reset hook state when the modal unmounts / target changes
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

  return (
    <>
      <div className="overlay" onClick={onClose} aria-hidden />
      <div className="panel-wrapper">
        <div className="price-history-panel alert-modal" role="dialog" aria-label="Set price alert">
          {/* Header */}
          <div className="price-history-header">
            <div className="ph-header-title">
              <h3>
                🔔 Set Price Alert
              </h3>
              <p className="ph-subtitle">
                {target.departureId} → {target.arrivalId} · {target.outboundDate}
                {target.currentPrice != null && (
                  <> · currently <strong>${target.currentPrice.toLocaleString()}</strong></>
                )}
              </p>
            </div>
            <button
              type="button"
              className="ph-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Success state */}
          {success ? (
            <div className="alert-modal-success">
              <span className="alert-modal-success-icon">✓</span>
              <p>Alert set! We'll notify <strong>{email}</strong> when the price drops to <strong>${Number(targetPrice).toLocaleString()}</strong> or below.</p>
              <button type="button" className="ph-load-btn" onClick={onClose}>
                Done
              </button>
            </div>
          ) : (
            <form className="price-history-form" onSubmit={handleSubmit}>
              <label className="alert-modal-label">
                Notify me at
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </label>

              <label className="alert-modal-label">
                When price drops to or below
                <div className="alert-modal-price-row">
                  <span className="alert-modal-currency">$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 350"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    required
                  />
                </div>
              </label>

              {error && <p className="error ph-error">{error}</p>}

              <button
                type="submit"
                className="ph-load-btn"
                disabled={creating || !email || !targetPrice}
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
