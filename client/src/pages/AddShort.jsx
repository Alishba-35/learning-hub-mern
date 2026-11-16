import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { languages } from '../data/languages.js';
import { request } from '../services/api.js';
import { MAX_TITLE, checkVideoFile, uploadToCloudinary } from '../services/shorts.js';
import '../styles/shorts.css';

// Video add karne ka form: YouTube link ya apni file. Student ka video teacher ke approve karne ke baad dikhta hai.
export default function AddShort() {
  const navigate = useNavigate();
  const abortRef = useRef(null);
  const [config, setConfig] = useState(null);
  const [mode, setMode] = useState('youtube');
  const [form, setForm] = useState({ title: '', description: '', languageSlug: '', youtubeUrl: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [done, setDone] = useState(null);

  useEffect(() => {
    let cancelled = false;
    request('/videos/config')
      .then((c) => !cancelled && setConfig(c))
      .catch(() => !cancelled && setConfig({ uploadEnabled: false, maxMb: 50, canReview: false }));
    return () => {
      cancelled = true;
      abortRef.current?.abort(); // page chhorte hi chalti upload band
    };
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setFieldErrors({});

    const local = {};
    if (form.title.trim().length < 3) local.title = 'Title must be at least 3 characters';
    if (mode === 'youtube' && !form.youtubeUrl.trim()) local.youtubeUrl = 'Paste a YouTube link';
    if (mode === 'upload') {
      const problem = checkVideoFile(file, config.maxMb);
      if (problem) local.file = problem;
    }
    if (Object.keys(local).length) return setFieldErrors(local);

    setBusy(true);
    setProgress(0);
    try {
      const common = { title: form.title, description: form.description, languageSlug: form.languageSlug };
      let body;
      if (mode === 'youtube') {
        body = { ...common, source: 'youtube', youtubeUrl: form.youtubeUrl };
      } else {
        const sig = await request('/videos/upload-signature', { method: 'POST' });
        abortRef.current = new AbortController();
        const uploaded = await uploadToCloudinary(file, sig, setProgress, abortRef.current.signal);
        body = { ...common, source: 'upload', ...uploaded };
      }
      const { video } = await request('/videos', { method: 'POST', body });
      setDone(video);
    } catch (err) {
      if (err.errors?.length) setFieldErrors(Object.fromEntries(err.errors.map((x) => [x.field, x.message])));
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="add-short card-panel text-center">
        <h1 className="h3">{done.status === 'approved' ? 'Video added!' : 'Video sent for approval'}</h1>
        <p>
          {done.status === 'approved'
            ? 'Your video is now live on Short Study.'
            : 'A teacher will check your video. It will appear on Short Study once it is approved.'}
        </p>
        <div className="d-flex gap-2 justify-content-center">
          <button type="button" className="btn btn-primary" onClick={() => navigate('/shorts')}>
            Go to Short Study
          </button>
          <button
            type="button"
            className="btn btn-outline-light"
            onClick={() => {
              setDone(null);
              setFile(null);
              setForm({ title: '', description: '', languageSlug: '', youtubeUrl: '' });
            }}
          >
            Add another
          </button>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-5" role="status">
        <span className="spinner-border spinner-border-sm me-2" />
        Loading...
      </div>
    );
  }

  return (
    <form className="add-short card-panel" onSubmit={submit} noValidate>
      <h1 className="h3 mb-3">Add a study video</h1>

      <div className="btn-group mb-3" role="group" aria-label="Video source">
        <button type="button" className={`btn ${mode === 'youtube' ? 'btn-light' : 'btn-outline-light'}`} onClick={() => setMode('youtube')}>
          YouTube link
        </button>
        <button
          type="button"
          className={`btn ${mode === 'upload' ? 'btn-light' : 'btn-outline-light'}`}
          onClick={() => setMode('upload')}
          disabled={!config.uploadEnabled}
          title={config.uploadEnabled ? '' : 'File upload is not set up yet'}
        >
          Upload a file
        </button>
      </div>
      {!config.uploadEnabled && <p className="small text-secondary">File upload is not available yet. You can still add a YouTube link.</p>}

      <label className="form-label" htmlFor="sv-title">
        Title
      </label>
      <input id="sv-title" className="form-control" value={form.title} onChange={set('title')} maxLength={MAX_TITLE} disabled={busy} />
      {fieldErrors.title && <div className="text-danger small mt-1">{fieldErrors.title}</div>}

      <label className="form-label mt-3" htmlFor="sv-lang">
        Topic
      </label>
      <select id="sv-lang" className="form-select" value={form.languageSlug} onChange={set('languageSlug')} disabled={busy}>
        <option value="">General</option>
        {languages.map((l) => (
          <option key={l.slug} value={l.slug}>
            {l.name}
          </option>
        ))}
      </select>

      <label className="form-label mt-3" htmlFor="sv-desc">
        Short description (optional)
      </label>
      <textarea id="sv-desc" className="form-control" rows={2} maxLength={300} value={form.description} onChange={set('description')} disabled={busy} />

      {mode === 'youtube' ? (
        <>
          <label className="form-label mt-3" htmlFor="sv-url">
            YouTube link
          </label>
          <input id="sv-url" className="form-control" placeholder="https://www.youtube.com/watch?v=..." value={form.youtubeUrl} onChange={set('youtubeUrl')} disabled={busy} />
          {fieldErrors.youtubeUrl && <div className="text-danger small mt-1">{fieldErrors.youtubeUrl}</div>}
        </>
      ) : (
        <>
          <label className="form-label mt-3" htmlFor="sv-file">
            Video file (MP4, MOV or WebM, up to {config.maxMb} MB)
          </label>
          <input id="sv-file" type="file" className="form-control" accept="video/mp4,video/quicktime,video/webm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={busy} />
          {fieldErrors.file && <div className="text-danger small mt-1">{fieldErrors.file}</div>}
          {busy && (
            <div className="progress mt-3" role="progressbar" aria-label="Upload progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="progress-bar" style={{ width: `${progress}%` }}>
                {progress}%
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="alert alert-danger py-2 mt-3" role="alert">
          {error}
        </div>
      )}

      <div className="d-flex gap-2 mt-4">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Please wait...' : 'Add video'}
        </button>
        <Link className="btn btn-outline-light" to="/shorts">
          Cancel
        </Link>
      </div>
    </form>
  );
}
