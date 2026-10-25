import { Link, useParams } from 'react-router-dom';
import { languages } from '../data/languages.js';
import NotFound from './NotFound.jsx';

export default function LessonPlaceholder() {
  const { slug } = useParams();
  const language = languages.find((l) => l.slug === slug);
  if (!language) return <NotFound />;

  return (
    <div className="text-center py-5">
      <h2>{language.name}</h2>
      <p>Lessons for this language are being moved to the new platform.</p>
      <Link className="btn btn-outline-light" to="/languages">
        Back to Languages
      </Link>
    </div>
  );
}
