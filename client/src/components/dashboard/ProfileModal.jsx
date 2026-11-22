import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { fileToAvatar } from '../../utils/avatar.js';
import Avatar from '../Avatar.jsx';

// Naam aur photo badalne ka dialog (dashboard ke sidebar mein avatar dabane se khulta hai)
export default function ProfileModal({ user, onClose }) {
  const { updateProfile } = useAuth();
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar || ''); // dikhne wali photo ('' = koi nahi)
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nameRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function choose(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // wahi file dobara chunne par bhi chale
    if (!file) return;
    setError('');
    try {
      setAvatar(await fileToAvatar(file));
    } catch (err) {
      setError(err.message);
    }
  }

  async function save(e) {
    e.preventDefault();
    const changes = {};
    if (name.trim() !== user.name) changes.name = name.trim();
    if (avatar !== (user.avatar || '')) changes.avatar = avatar || null;
    if (Object.keys(changes).length === 0) return onClose();
    setError('');
    setBusy(true);
    try {
      await updateProfile(changes);
      onClose();
    } catch (err) {
      setError(err.errors?.[0]?.message || err.message);
      setBusy(false);
    }
  }

  return (
    <div className="profile-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <h2 id="profile-title">Edit profile</h2>
        <form onSubmit={save}>
          <div className="profile-photo">
            <Avatar user={{ name: name || user.name, avatar }} className="profile-avatar" />
            <div className="profile-photo-actions">
              <button type="button" className="profile-btn" onClick={() => fileRef.current?.click()}>
                {avatar ? 'Change photo' : 'Add photo'}
              </button>
              {avatar && (
                <button type="button" className="profile-btn profile-btn--ghost" onClick={() => setAvatar('')}>
                  Remove
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={choose} aria-label="Choose a profile photo" />
            </div>
          </div>

          <label className="profile-label" htmlFor="profile-name">
            Name
          </label>
          <input id="profile-name" ref={nameRef} className="profile-input" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={60} required autoComplete="name" />

          <label className="profile-label" htmlFor="profile-email">
            Email
          </label>
          <input id="profile-email" className="profile-input" value={user.email} readOnly disabled />

          {error && (
            <p className="profile-error" role="alert">
              {error}
            </p>
          )}
          <div className="profile-actions">
            <button type="button" className="profile-btn profile-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="profile-btn profile-btn--primary" disabled={busy || name.trim().length < 2}>
              {busy ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
