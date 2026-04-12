import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <p className="text-7xl mb-4">🏀</p>
      <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
      <p className="text-gray-500 mb-6">This page is out of bounds.</p>
      <Link to="/" className="btn-primary">
        Go Home
      </Link>
    </div>
  );
}
