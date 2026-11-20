import { youtubeEmbed, youtubeThumb } from '../../services/shorts.js';

// Ek video. Pehle sirf thumbnail + Play button; player tab load hota hai jab user Play dabaye.
// Page par ek waqt mein ek hi video chalta hai (active), is liye page tez rehta hai.
export default function ShortCard({ video, active, onPlay, onDelete, onApprove, children }) {
  const isYoutube = video.source === 'youtube';

  return (
    <article className="short-card">
      <div className="short-frame">
        {active ? (
          isYoutube ? (
            <iframe
              src={youtubeEmbed(video.youtubeId)}
              title={video.title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <video src={video.streamUrl} controls autoPlay playsInline preload="metadata" />
          )
        ) : (
          <button type="button" className="short-play" onClick={() => onPlay(video.id)} aria-label={`Play ${video.title}`}>
            {isYoutube ? <img src={youtubeThumb(video.youtubeId)} alt="" loading="lazy" /> : <span className="short-upload-bg" aria-hidden="true" />}
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
          {video.status === 'rejected' && <span className="badge text-bg-danger ms-2">Rejected</span>}
        </p>
        {video.status === 'rejected' && video.rejectReason && <p className="short-desc">Reason: {video.rejectReason}</p>}
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
        {children}
      </div>
    </article>
  );
}
