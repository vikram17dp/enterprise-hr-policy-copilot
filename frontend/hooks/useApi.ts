"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { toErrorMessage } from "@/types/api";

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Minimal data-fetching hook (the project does not use React Query/SWR).
 *
 * - Runs `fetcher` on mount and whenever `deps` change.
 * - Guards against stale responses: an in-flight request that resolves after
 *   the deps changed (or after unmount) is ignored, so rapid filter changes
 *   never render out-of-order data.
 * - `refetch()` forces a reload (used after mutations).
 *
 * Follows the codebase convention (see useDocuments): the effect awaits first
 * and only sets state in the async continuation, never synchronously in the
 * effect body. The "loading" flip on dependency change uses React's
 * adjust-state-during-render pattern rather than an effect.
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList
): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Keep the latest fetcher without writing a ref during render.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  // A stable, serializable signature of the current deps + nonce. When it
  // changes we re-enter the loading state during render (React endorses this
  // "store info from previous renders" pattern; it avoids a cascading effect).
  const depsKey = JSON.stringify([...deps, nonce]);
  const [prevKey, setPrevKey] = useState(depsKey);
  if (depsKey !== prevKey) {
    setPrevKey(depsKey);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const result = await fetcherRef.current();
        if (!active) return;
        setData(result);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(toErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    };

    // Async fetch: setState runs only after the awaited request settles, never
    // synchronously during the effect body.
    void run();

    return () => {
      active = false;
    };
  }, [depsKey]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, refetch };
}
