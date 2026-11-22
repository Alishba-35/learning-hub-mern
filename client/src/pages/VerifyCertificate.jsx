import { Link, useParams } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import { useApi } from '../hooks/useApi.js';
import '../styles/verify.css';

const when = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

// Public page (login ki zaroorat nahi): koi bhi certificate ka code daal kar check kar sakta hai ke asli hai ya nahi
export default function VerifyCertificate() {
  const { code } = useParams();
  const { data, error, loading } = useApi(`/certificates/verify/${encodeURIComponent(code)}`);

  let body;
  if (loading) {
    body = (
      <p role="status" className="verify-note">
        Checking this certificate...
      </p>
    );
  } else if (data?.valid) {
    body = (
      <>
        <div className="verify-badge is-ok" aria-hidden="true">
          &#10003;
        </div>
        <h1>This certificate is genuine</h1>
        <dl className="verify-details">
          <div>
            <dt>Awarded to</dt>
            <dd>{data.studentName}</dd>
          </div>
          <div>
            <dt>Course</dt>
            <dd>{data.languageName}</dd>
          </div>
          {data.lessonCount > 0 && (
            <div>
              <dt>Lessons completed</dt>
              <dd>{data.lessonCount}</dd>
            </div>
          )}
          <div>
            <dt>Issued on</dt>
            <dd>{when(data.issuedAt)}</dd>
          </div>
          <div>
            <dt>Certificate ID</dt>
            <dd>{data.code}</dd>
          </div>
        </dl>
        <a className="verify-btn" href={`/api/certificates/${data.code}/pdf`} target="_blank" rel="noreferrer">
          View the certificate (PDF)
        </a>
      </>
    );
  } else if (data?.revoked) {
    body = (
      <>
        <div className="verify-badge is-bad" aria-hidden="true">
          !
        </div>
        <h1>This certificate has been revoked</h1>
        <p className="verify-note">It is no longer valid. Please contact Learning Hub if you think this is a mistake.</p>
      </>
    );
  } else if (error?.status === 404) {
    body = (
      <>
        <div className="verify-badge is-bad" aria-hidden="true">
          ?
        </div>
        <h1>No certificate found</h1>
        <p className="verify-note">We could not find a certificate with the code {code}. Check the code and try again.</p>
      </>
    );
  } else {
    body = (
      <>
        <div className="verify-badge is-bad" aria-hidden="true">
          !
        </div>
        <h1>Could not check right now</h1>
        <p className="verify-note">Please try again in a few minutes.</p>
      </>
    );
  }

  return (
    <main className="verify-page">
      <article className="verify-card" aria-live="polite">
        <BrandLogo surface="auto" size={110} className="verify-logo" />
        <p className="verify-brand">Learning Hub</p>
        {body}
        <Link className="verify-home" to="/">
          Go to Learning Hub
        </Link>
      </article>
    </main>
  );
}
