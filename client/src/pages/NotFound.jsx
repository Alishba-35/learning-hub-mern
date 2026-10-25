import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="text-center py-5">
      <h2>Page not found</h2>
      <Link className="btn btn-outline-light mt-3" to="/">
        Go Home
      </Link>
    </div>
  );
}
