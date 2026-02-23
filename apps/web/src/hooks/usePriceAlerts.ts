import { useState, useCallback } from "react";
import type { CreatePriceAlertDto } from "@repo/types";

interface UsePriceAlertsReturn {
  creating: boolean;
  success: boolean;
  error: string | null;
  createAlert: (data: CreatePriceAlertDto) => Promise<void>;
  reset: () => void;
}

export function usePriceAlerts(): UsePriceAlertsReturn {
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createAlert = useCallback(async (data: CreatePriceAlertDto) => {
    setCreating(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/price-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as { message?: string };
      if (!res.ok)
        throw new Error(json?.message ?? `Request failed: ${res.status}`);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create alert");
    } finally {
      setCreating(false);
    }
  }, []);

  const reset = useCallback(() => {
    setCreating(false);
    setSuccess(false);
    setError(null);
  }, []);

  return { creating, success, error, createAlert, reset };
}
