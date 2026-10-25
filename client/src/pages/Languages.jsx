import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { languages } from '../data/languages.js';

export default function Languages() {
  const { logout } = useAuth();
  return (
    <div className="page-navy">
      <div className="lang-corner">
        <Link to="/dashboard">Dashboard</Link>
        <button type="button" onClick={logout}>
          Logout
        </button>
      </div>
      <div className="lang-grid">
        {languages.map((lang) => (
          <div className="card lang-card" key={lang.slug} style={{ '--lang-color': lang.color }}>
            <img src={lang.image} className="card-img-top" alt={lang.name} />
            <div className="card-body">
              <div className="card-reveal">
                <p className="card-text">{lang.description}</p>
                <Link className="btn btn-primary" to={`/learn/${lang.slug}`}>
                  Start
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
