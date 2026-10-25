import { Link } from 'react-router-dom';

export default function ComingSoon({ title, message = 'This section is being moved to the new platform.' }) {
  return (
    <div className="text-center py-5">
      <h2>{title}</h2>
      <p>{message}</p>
      <Link className="btn btn-outline-light" to="/languages">
        Back to Languages
      </Link>
    </div>
  );
}
