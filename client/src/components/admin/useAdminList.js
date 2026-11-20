import { useCallback, useEffect, useState } from 'react';
import { request } from '../../services/api.js';

// Admin API se data mangwata hai; params badalne par dobara. Pattern ManageShorts jaisa: setState await ke baad.
export function useAdminList(path, params = {}) {
  const [state, setState] = useState({ data: null, error: '' });
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();

  const load = useCallback(async () => {
    try {
      setState({ data: await request(query ? `${path}?${query}` : path), error: '' });
    } catch (err) {
      setState((s) => ({ ...s, error: err.message || 'Could not load data' }));
    }
  }, [path, query]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  return { ...state, reload: load };
}
