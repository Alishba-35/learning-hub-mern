import { useEffect, useState } from 'react';
import { request } from '../services/api.js';

// GET request karta hai; path badalne par naya data lata hai. Purana jawab kabhi naye path ke sath nahi dikhta.
export function useApi(path) {
  const [result, setResult] = useState({ path: null, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    request(path)
      .then((data) => !cancelled && setResult({ path, data, error: null }))
      .catch((error) => !cancelled && setResult({ path, data: null, error }));
    return () => {
      cancelled = true;
    };
  }, [path]);

  const loading = result.path !== path;
  return { data: loading ? null : result.data, error: loading ? null : result.error, loading };
}
