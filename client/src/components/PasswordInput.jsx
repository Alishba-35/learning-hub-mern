import { useState } from 'react';

export default function PasswordInput({ id, label, error, ...inputProps }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="mb-3">
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <div className="input-group">
        <input id={id} className="form-control" type={visible ? 'text' : 'password'} {...inputProps} />
        <button
          type="button"
          className="btn btn-outline-light"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {error && <div className="text-danger small mt-1">{error}</div>}
    </div>
  );
}
