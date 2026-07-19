import { useState, useEffect, useCallback } from 'react';
import api from '@/api/axios';

/**
 * Generic data-fetching hook.
 * @param {string} url - API path
 * @param {object} options - { params, enabled, onSuccess }
 */
export function useApi(url, options = {}) {
  const { params = {}, enabled = true, onSuccess } = options;
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const paramsKey = JSON.stringify(params);

  const fetchData = useCallback(async () => {
    if (!enabled || !url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url, { params });
      setData(res.data.data);
      setMeta(res.data.meta || null);
      onSuccess?.(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [url, paramsKey, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, meta, loading, error, refetch: fetchData };
}
