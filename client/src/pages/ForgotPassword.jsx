import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { request } from '../services/api.js';

// Password reset: 1) email likho  2) email par aaya 6 digit code + naya password  3) ho gaya
export default function ForgotPassword() {
  const [step, setStep] = useState('email'); // email | code | done
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // "Resend code" ka countdown
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await request('/auth/forgot-password', { method: 'POST', body: { email }, auth: false });
      setInfo(res.message);
      setCooldown(res.resendSeconds || 60);
      setStep('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    if (password !== confirm) {
      setFieldErrors({ confirm: 'Passwords do not match' });
      return;
    }
    setBusy(true);
    try {
      await request('/auth/reset-password', { method: 'POST', body: { email, otp, password }, auth: false });
      setStep('done');
    } catch (err) {
      setError(err.message);
      if (err.errors?.length) setFieldErrors(Object.fromEntries(err.errors.map((i) => [i.field, i.message])));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-plum page-plum--auth">
      <BrandLogo size={120} className="brand-logo--hero" />
      <div className="auth-simple">
        <h3>
          <i>Reset password</i>
        </h3>

        {step === 'email' && (
          <form onSubmit={sendCode} aria-label="Request a reset code">
            <p className="small">Enter the email you signed up with. We will send you a 6-digit code.</p>
            <div className="mb-3">
              <label className="form-label" htmlFor="fp-email">
                Email
              </label>
              <input id="fp-email" type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </div>
            {error && (
              <div className="alert alert-danger py-2" role="alert">
                {error}
              </div>
            )}
            <button type="submit" className="btn btn-light w-100" disabled={busy}>
              {busy ? 'Sending...' : 'Send code'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={resetPassword} aria-label="Enter the code and a new password">
            <div className="alert alert-info py-2 small" role="status">
              {info}
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="fp-otp">
                6-digit code
              </label>
              <input
                id="fp-otp"
                className="form-control otp-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
              />
              {fieldErrors.otp && <div className="text-danger small mt-1">{fieldErrors.otp}</div>}
            </div>
            <PasswordInput id="fp-password" name="password" label="New password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} error={fieldErrors.password} />
            <PasswordInput id="fp-confirm" name="confirm" label="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required minLength={8} error={fieldErrors.confirm} />
            {error && Object.keys(fieldErrors).length === 0 && (
              <div className="alert alert-danger py-2" role="alert">
                {error}
              </div>
            )}
            <button type="submit" className="btn btn-light w-100" disabled={busy || otp.length !== 6}>
              {busy ? 'Please wait...' : 'Reset password'}
            </button>
            <button type="button" className="btn btn-link w-100 mt-2" onClick={sendCode} disabled={busy || cooldown > 0}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <div role="status">
            <div className="alert alert-success py-2">Your password has been updated. You can log in now.</div>
          </div>
        )}

        <hr />
        <Link to="/login" className="btn btn-danger w-100">
          Back to Login
        </Link>
      </div>
    </div>
  );
}
