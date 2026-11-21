import { useState } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { request } from '../../services/api.js';

const when = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
const verifyUrl = (code) => `${window.location.origin}/verify/${code}`;

// Jis language ke saare lessons khatam hon uska certificate: lo, PDF download karo, ya verify link share karo
export default function Certificates({ languages }) {
  const { data } = useApi('/certificates'); // error aaye to bas khali list; dashboard na ruke
  const [issued, setIssued] = useState({});
  const [busy, setBusy] = useState('');
  const [errors, setErrors] = useState({});
  const [copied, setCopied] = useState('');

  const owned = new Map((data?.certificates ?? []).map((c) => [c.languageSlug, c]));
  for (const [slug, cert] of Object.entries(issued)) owned.set(slug, cert);

  const cards = languages.filter((l) => owned.has(l.slug) || (l.total > 0 && l.completed >= l.total));
  const closest = languages.filter((l) => l.total > 0 && l.completed < l.total).sort((a, b) => b.percent - a.percent)[0];

  async function getCertificate(slug) {
    setBusy(slug);
    setErrors((e) => ({ ...e, [slug]: '' }));
    try {
      const res = await request(`/certificates/${slug}`, { method: 'POST' });
      setIssued((i) => ({ ...i, [slug]: res.certificate }));
    } catch (err) {
      setErrors((e) => ({ ...e, [slug]: err.message || 'Could not create the certificate' }));
    } finally {
      setBusy('');
    }
  }

  async function copyLink(code) {
    try {
      await navigator.clipboard.writeText(verifyUrl(code));
      setCopied(code);
    } catch {
      setCopied('');
    }
  }

  return (
    <>
      <h2 className="section-title" id="certificates">
        Certificates <small>({owned.size})</small>
      </h2>
      {cards.length === 0 ? (
        <p className="cert-hint">
          Finish every lesson of a language to earn a certificate.
          {closest ? ` Closest: ${closest.name}, ${closest.percent}% done.` : ''}
        </p>
      ) : (
        <ul className="cert-list">
          {cards.map((l) => {
            const cert = owned.get(l.slug);
            return (
              <li key={l.slug} className="cert-card" style={{ '--cert-color': l.color }}>
                <div>
                  <h3>{l.name} Course</h3>
                  {!cert && <p>You finished every lesson. Your certificate is ready.</p>}
                  {cert && !cert.revoked && (
                    <p>
                      Earned on {when(cert.issuedAt)}
                      <small className="cert-id">ID {cert.code}</small>
                    </p>
                  )}
                  {cert?.revoked && <p>This certificate was withdrawn. Please contact your teacher.</p>}
                  {errors[l.slug] && (
                    <p className="cert-error" role="alert">
                      {errors[l.slug]}
                    </p>
                  )}
                </div>
                <div className="cert-actions">
                  {!cert && (
                    <button type="button" className="btn-dash primary" disabled={busy === l.slug} onClick={() => getCertificate(l.slug)}>
                      {busy === l.slug ? 'Creating...' : 'Get certificate'}
                    </button>
                  )}
                  {cert && !cert.revoked && (
                    <>
                      <a className="btn-dash primary" href={`/api/certificates/${cert.code}/pdf`} target="_blank" rel="noreferrer">
                        Download PDF
                      </a>
                      <button type="button" className="btn-dash" onClick={() => copyLink(cert.code)}>
                        {copied === cert.code ? 'Link copied' : 'Copy verify link'}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
