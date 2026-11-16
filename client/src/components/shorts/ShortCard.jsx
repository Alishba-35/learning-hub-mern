import { uploadThumb, youtubeEmbed, youtubeThumb } from '../../services/shorts.js';

// Ek video. Pehle sirf thumbnail + Play button; player tab load hota hai jab user Play dabaye.
// Page par ek waqt mein ek hi video chalta hai (active), is liye page tez rehta hai.
export default function ShortCard({ video, active, onPlay, onDelete, onApprove }) {
  const thumb = video.source === 'youtube' ? youtubeThumb(video.youtubeId) : uploadThumb(video.fileUrl);

  return (
    <article className="short-card">
      <div className="short-frame">
        {active ? (
          video.source === 'youtube' ? (
            <iframe
              src={youtubeEmbed(video.youtubeId)}
              title={video.title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <video src={video.fileUrl} controls autoPlay playsInline preload="metadata" poster={thumb} />
          )
        ) : (
          <button type="button" className="short-play" onClick={() => onPlay(video.id)} aria-label={`Play ${video.title}`}>
            <img src={thumb} alt="" loading="lazy" />
            <span className="short-play-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        )}
      </div>

      <div className="short-meta">
        <h2 className="short-title">{video.title}</h2>
        {video.description && <p className="short-desc">{video.description}</p>}
        <p className="short-by">
          Uploaded by {video.uploaderName}
          {video.status === 'pending' && <span className="badge text-bg-warning ms-2">Waiting for approval</span>}
        </p>
        {(onApprove || (onDelete && video.canDelete)) && (
          <div className="short-actions">
            {onApprove && video.status === 'pending' && (
              <button type="button" className="btn btn-success btn-sm" onClick={() => onApprove(video.id)}>
                Approve
              </button>
            )}
            {onDelete && video.canDelete && (
              <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => onDelete(video)}>
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
