import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { request } from '../services/api.js';
import { localDay } from '../utils/day.js';
import { useApi } from './useApi.js';

export const DRAFT_DEBOUNCE_MS = 2000;

// Ek language ka progress: mukammal lessons, aakhri lesson, code drafts, aur auto-save.
export function useLessonProgress(slug) {
  const { data, error, loading } = useApi(`/progress/${slug}`);
  const [extraDone, setExtraDone] = useState([]);
  const completed = useMemo(() => new Set([...(data?.completed ?? []), ...extraDone]), [data, extraDone]);

  const complete = useCallback(
    async (topic) => {
      const result = await request(`/progress/${slug}/topics/${topic}/complete`, {
        method: 'POST',
        body: { day: localDay() },
      });
      setExtraDone((list) => [...list, topic]);
      return result;
    },
    [slug]
  );

  const touch = useCallback(
    (topic) => {
      request(`/progress/${slug}/last`, { method: 'PUT', body: { topic } }).catch(() => {});
    },
    [slug]
  );

  // ---- code drafts: har change par thori der baad server par save ----
  const timers = useRef(new Map());
  const pending = useRef(new Map()); // key -> code jo abhi server tak nahi pahunchi

  const send = useCallback(
    (key, code, keepalive = false) => {
      const [topic, index] = key.split('__');
      return request(`/progress/${slug}/topics/${topic}/drafts/${index}`, {
        method: 'PUT',
        body: { code },
        keepalive,
      });
    },
    [slug]
  );

  const flush = useCallback(
    (keepalive = false) => {
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
      pending.current.forEach((code, key) => {
        send(key, code, keepalive)
          .then(() => {
            if (pending.current.get(key) === code) pending.current.delete(key);
          })
          .catch(() => {});
      });
    },
    [send]
  );

  const saveDraft = useCallback(
    (topic, index, code, onStatus) => {
      const key = `${topic}__${index}`;
      pending.current.set(key, code);
      clearTimeout(timers.current.get(key));
      onStatus?.('saving');
      timers.current.set(
        key,
        setTimeout(async () => {
          timers.current.delete(key);
          try {
            await send(key, code);
            if (pending.current.get(key) === code) pending.current.delete(key);
            onStatus?.('saved');
          } catch {
            onStatus?.('offline');
          }
        }, DRAFT_DEBOUNCE_MS)
      );
    },
    [send]
  );

  // Tab band/chhupa ho, page chhoda jaye, ya internet wapas aaye: jo baqi hai abhi bhej do
  useEffect(() => {
    const onHide = () => flush(true);
    const onVisibility = () => document.visibilityState === 'hidden' && flush(true);
    const onOnline = () => flush(false);
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      flush(true);
    };
  }, [flush]);

  return useMemo(
    () => ({
      loading,
      available: !error,
      completed,
      lastTopic: data?.lastTopic ?? '',
      drafts: data?.drafts ?? {},
      complete,
      touch,
      saveDraft,
    }),
    [loading, error, completed, data, complete, touch, saveDraft]
  );
}
