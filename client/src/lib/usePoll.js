import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

/**
 * Fetch `path` now and every `ms` while the tab is visible.
 * Returns { data, error, loading, refresh, setData }.
 */
export function usePoll(path, ms = 5000, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const live = useRef(true);

  const refresh = useCallback(async () => {
    if (!path) return;
    try {
      const d = await api(path);
      if (!live.current) return;
      setData(d);
      setError(null);
    } catch (e) {
      if (live.current) setError(e);
    } finally {
      if (live.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    live.current = true;
    if (!enabled || !path) return undefined;
    setLoading(true);
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, ms);
    const onVis = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('qless:data', refresh);
    return () => {
      live.current = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('qless:data', refresh);
    };
  }, [path, ms, enabled, refresh]);

  return { data, error, loading, refresh, setData };
}
