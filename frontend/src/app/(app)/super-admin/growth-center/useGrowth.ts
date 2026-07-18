"use client";

// Growth Center data hook — independent of src/hooks/useApi.ts. It only ever
// talks to the Growth Center namespace, and only fires when enabled (the
// pages pass `enabled: user.role === "super_admin"`), so unauthorized
// sessions never even preload Growth Center API calls.

import { useCallback, useEffect, useState } from "react";
import { growthApi, GrowthApiError } from "./api";

interface GrowthResult<T> {
  data: T | undefined;
  error: string | null;
  errorStatus: number | null;
  loading: boolean;
  reload: () => void;
}

export function useGrowth<T>(path: string | null): GrowthResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (path === null) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    growthApi<T>(path)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof GrowthApiError) {
          setError(err.message);
          setErrorStatus(err.status);
        } else {
          setError("Request failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, error, errorStatus, loading, reload };
}
