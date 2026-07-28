import { useCallback, useEffect, useRef, useState } from 'react';

// Generic data-fetching hook with loading / error / refetch support.
// Works with any async service function; ready for real API integration.

export function useFetch(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const activeRef = useRef(0);

  const load = useCallback(async () => {
    const callId = ++activeRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (callId === activeRef.current) setData(result);
    } catch (err) {
      if (callId === activeRef.current) setError(err.message || 'Something went wrong');
    } finally {
      if (callId === activeRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load, setData };
}
