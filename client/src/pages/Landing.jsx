import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

// fade-up animation 0.8s ki hai; us ke mukammal hone ke baad button badalta hai
const REVEAL_MS = 900;

export default function Landing() {
  const { user } = useAuth();
  // idle: sirf Start button | revealing: tagline animate ho rahi hai | ready: "Go to ..." link
  const [stage, setStage] = useState('idle');

  useEffect(() => {
    if (stage !== 'revealing') return undefined;
    const timer = setTimeout(() => setStage('ready'), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [stage]);

  return (
    <div className="page-plum page-plum--landing">
      <h1 className="m-0 fade-up">
        <img src="/images/welcome.png" alt="Welcome Programmers" />
      </h1>

      {stage !== 'idle' && (
        <p className="m-0 fade-up" data-testid="tagline">
          <img src="/images/programmers.png" alt="Let's start your journey" />
        </p>
      )}

      <div className="landing-actions">
        {stage === 'ready' ? (
          <Link className="btn btn-light" to={user ? '/languages' : '/login'}>
            {user ? 'Go to Languages' : 'Go to Login'}
          </Link>
        ) : (
          <button
            type="button"
            className="btn btn-light"
            disabled={stage === 'revealing'}
            onClick={() => setStage('revealing')}
          >
            Start
          </button>
        )}
      </div>
    </div>
  );
}
