import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle.js';

export default function NotFound() {
  usePageTitle('Page not found', { noindex: true });
  return (
    <div className="text-center py-5">
      <h2>Page not found</h2>
      <Link className="btn btn-outline-light mt-3" to="/">
        Go Home
      </Link>
    </div>
  );
}
