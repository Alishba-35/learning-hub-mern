import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ShortCard from '../components/shorts/ShortCard.jsx';
import { languages } from '../data/languages.js';
import { request } from '../services/api.js';
import '../styles/shorts.css';

// Short Study: chhote study videos (YouTube ya upload kiye hue), language ke hisaab se filter
export default function ShortsStudy() {
  const [language, setLanguage] = useState('');
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [activeId, setActiveId] = useState(null);
  const [result, setResult] = useState({ key: '', language: '', videos: [], pages: 1, error: '' });

  const key = `${language}:${page}:${retry}`;

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ page: String(page) });
    if (language) query.set('language', language);
    request(`/videos?${query}`)
      .then((data) => {
        if (cancelled) return;
        setResult((prev) => ({
          key,
          language,
          // page 1 purani list badal deta hai, "Load more" us ke neeche jorta hai
          videos: page === 1 || prev.language !== language ? data.videos : [...prev.videos, ...data.videos],
          pages: data.pages,
          error: '',
        }));
      })
      .catch((err) => !cancelled && setResult((prev) => ({ ...prev, key, language, error: err.message || 'Could not load videos' })));
    return () => {
      cancelled = true;
    };
  }, [language, page, retry, key]);

  const pick = (slug) => {
    setLanguage(slug);
    setPage(1);
    setActiveId(null);
  };

  const loading = result.key !== key;
  const videos = result.language === language ? result.videos : [];
  const { error, pages } = result;

  return (
    <div className="shorts-page">
      <div className="shorts-head">
        <h1>Short Study Videos</h1>
        <div className="shorts-head-links">
          <Link className="btn btn-primary btn-sm" to="/shorts/add">
            Add a video
          </Link>
          <Link className="btn btn-outline-light btn-sm" to="/shorts/manage">
            My videos
          </Link>
        </div>
      </div>

      <div className="shorts-filter" role="group" aria-label="Filter by language">
        <button type="button" className={`btn btn-sm ${language === '' ? 'btn-light' : 'btn-outline-light'}`} onClick={() => pick('')}>
          All
        </button>
        {languages.map((l) => (
          <button
            key={l.slug}
            type="button"
            className={`btn btn-sm ${language === l.slug ? 'btn-light' : 'btn-outline-light'}`}
            onClick={() => pick(l.slug)}
          >
            {l.name}
          </button>
        ))}
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}{' '}
          <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => setRetry((n) => n + 1)}>
            Try again
          </button>
        </div>
      )}

      <div className="shorts-gallery">
        {videos.map((v) => (
          <ShortCard key={v.id} video={v} active={activeId === v.id} onPlay={setActiveId} />
        ))}
      </div>

      {loading && (
        <div className="text-center py-4" role="status">
          <span className="spinner-border spinner-border-sm me-2" />
          Loading...
        </div>
      )}
      {!loading && !error && videos.length === 0 && <p className="text-center py-4">No videos yet for this topic. Be the first to add one!</p>}
      {!loading && !error && page < pages && (
        <div className="text-center py-3">
          <button type="button" className="btn btn-outline-light" onClick={() => setPage((p) => p + 1)}>
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
