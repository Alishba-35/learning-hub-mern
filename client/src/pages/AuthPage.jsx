import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import PasswordInput from '../components/PasswordInput.jsx';

const initialForm = { name: '', email: '', password: '', purpose: '', remember: true };

function AuthForm({ mode, active, onSwitch }) {
  const isSignup = mode === 'signup';
  const { login, register } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const id = (field) => `${mode}-${field}`;

  const update = (e) => {
    const { name, type, value, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSubmitting(true);
    try {
      if (isSignup) {
        await register({
          name: form.name,
          email: form.email,
          password: form.password,
          purpose: form.purpose,
          remember: form.remember,
        });
      } else {
        await login({ email: form.email, password: form.password, remember: form.remember });
      }
      // Kamyabi par GuestOnly khud /languages par bhej deta hai
    } catch (err) {
      setError(err.message);
      if (err.errors?.length) {
        setFieldErrors(Object.fromEntries(err.errors.map((i) => [i.field, i.message])));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  return (
    // inactive form screen reader aur keyboard dono se hidden rehta hai
    <div className={`auth-card auth-card--${mode}${active ? ' is-active' : ''}`} aria-hidden={!active} inert={!active}>
      <h3>
        <i>{isSignup ? 'Signup' : 'Login'}</i>
      </h3>

      <form onSubmit={handleSubmit} aria-label={isSignup ? 'Signup form' : 'Login form'}>
        {isSignup && (
          <div className="mb-3">
            <label className="form-label" htmlFor={id('name')}>
              Name
            </label>
            <input
              id={id('name')}
              name="name"
              className="form-control"
              value={form.name}
              onChange={update}
              autoComplete="name"
              required
              minLength={2}
              maxLength={60}
            />
            {fieldErrors.name && <div className="text-danger small mt-1">{fieldErrors.name}</div>}
          </div>
        )}

        <div className="mb-3">
          <label className="form-label" htmlFor={id('email')}>
            Email
          </label>
          <input
            id={id('email')}
            name="email"
            type="email"
            className="form-control"
            value={form.email}
            onChange={update}
            autoComplete="email"
            required
          />
          {fieldErrors.email && <div className="text-danger small mt-1">{fieldErrors.email}</div>}
        </div>

        <PasswordInput
          id={id('password')}
          name="password"
          label="Password"
          value={form.password}
          onChange={update}
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          required
          minLength={isSignup ? 8 : undefined}
          error={fieldErrors.password}
        />

        {isSignup && (
          <div className="mb-3">
            <label className="form-label" htmlFor={id('purpose')}>
              Purpose
            </label>
            <select id={id('purpose')} name="purpose" className="form-select" value={form.purpose} onChange={update}>
              <option value="">Select Purpose</option>
              <option value="Study">Study</option>
              <option value="Teaching">Teaching</option>
            </select>
          </div>
        )}

        <div className="form-check mb-3">
          <input
            id={id('remember')}
            name="remember"
            type="checkbox"
            className="form-check-input"
            checked={form.remember}
            onChange={update}
          />
          <label className="form-check-label" htmlFor={id('remember')}>
            Keep me signed in for 30 days
          </label>
        </div>

        {error && !hasFieldErrors && (
          <div className="alert alert-danger py-2" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className={`btn w-100 ${isSignup ? 'btn-danger' : 'btn-light'}`} disabled={submitting}>
          {submitting ? 'Please wait...' : isSignup ? 'Sign up' : 'Login'}
        </button>
      </form>

      <hr />
      <button type="button" className={`btn w-100 ${isSignup ? 'btn-secondary' : 'btn-danger'}`} onClick={onSwitch}>
        {isSignup ? 'Back to Login' : 'Sign up'}
      </button>
    </div>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState('login');

  return (
    <div className="page-plum page-plum--auth">
      <div className={`auth-wrapper show-${mode}`}>
        <AuthForm mode="login" active={mode === 'login'} onSwitch={() => setMode('signup')} />
        <AuthForm mode="signup" active={mode === 'signup'} onSwitch={() => setMode('login')} />
      </div>
    </div>
  );
}
