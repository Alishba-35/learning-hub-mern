import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ShortCard from '../components/shorts/ShortCard.jsx';
import { request } from '../services/api.js';
import '../styles/shorts.css';

// "My videos" sab ke liye. Teacher/admin ko upar "Waiting for approval" list bhi milti hai.
export default function ManageShorts() {
  const [mine, setMine] = useState(null);
  const [pending, setPending] = useState([]);
  const [canReview, setCanReview] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const config = await request('/videos/config');
      setCanReview(config.canReview);
      const [m, p] = await Promise.all([request('/videos/mine'), config.canReview ? request('/videos/pending') : { videos: [] }]);
      setMine(m.videos);
      setPending(p.videos);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load videos');
      setMine((m) => m ?? []);
    }
  }, []);

  useEffect(() => {
    // refresh async hai: setState await ke baad hota hai, effect ke andar seedha nahi
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  async function act(fn) {
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err.message || 'Something went wrong');
    }
  }
  const approve = (id) => act(() => request(`/videos/${id}/approve`, { method: 'PATCH' }));
  const remove = (video) => {
    if (window.confirm(`Delete "${video.title}"?`)) act(() => request(`/videos/${video.id}`, { method: 'DELETE' }));
  };

  if (mine === null) {
    return (
      <div className="text-center py-5" role="status">
        <span className="spinner-border spinner-border-sm me-2" />
        Loading...
      </div>
    );
  }

  return (
    <div className="shorts-page">
      <div className="shorts-head">
        <h1>My videos</h1>
        <div className="shorts-head-links">
          <Link className="btn btn-primary btn-sm" to="/shorts/add">
            Add a video
          </Link>
          <Link className="btn btn-outline-light btn-sm" to="/shorts">
            Back to Short Study
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {canReview && (
        <section className="mb-5">
          <h2 className="h4 text-center">Waiting for approval ({pending.length})</h2>
          {pending.length === 0 && <p className="text-center">Nothing to review right now.</p>}
          <div className="shorts-gallery">
            {pending.map((v) => (
              <ShortCard key={v.id} video={v} active={activeId === v.id} onPlay={setActiveId} onApprove={approve} onDelete={remove} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="h4 text-center">Videos I added ({mine.length})</h2>
        {mine.length === 0 && <p className="text-center">You have not added any video yet.</p>}
        <div className="shorts-gallery">
          {mine.map((v) => (
            <ShortCard key={v.id} video={v} active={activeId === v.id} onPlay={setActiveId} onDelete={remove} />
          ))}
        </div>
      </section>
    </div>
  );
}
