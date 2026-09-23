"use client";

import { useCallback, useEffect, useState } from "react";

import { listDocuments } from "@/lib/api/documents";
import type { PolicyDocument } from "@/types/document";
import { toErrorMessage } from "@/types/api";

/**
 * Loads the policy documents an employee can view.
 * Provides loading/error state and a reload function for error recovery.
 */
export function useDocuments() {
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Await-first so no state is set synchronously during the mount effect.
  const fetchData = useCallback(async () => {
    try {
      const data = await listDocuments();
      setDocuments(data);
      setError(null);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Manual retry (event-driven) re-enables the loading state.
  const reload = useCallback(() => {
    setLoading(true);
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    // Async fetch-on-mount: setState runs only after the awaited request
    // resolves, never synchronously during the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  return { documents, loading, error, reload };
}
