import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { seriesApi } from '../api/series';
import { useAuthStore } from '../store/authStore';

export function HomePage() {
  const { isAuthenticated } = useAuthStore();
  const { data: series = [] } = useQuery({
    queryKey: ['series'],
    queryFn: () => seriesApi.getAll().then((r) => r.data),
  });

  const activeSeries = series.filter((s) => s.status === 'active').length;
  const completedSeries = series.filter((s) => s.status === 'complete').length;
  const totalSeries = series.length;

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* Hero */}
      <div className="text-center py-10">
        <div className="text-7xl mb-4">🏀</div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-3">
          NBA Playoff{' '}
          <span className="text-nba-blue">Prediction</span>{' '}
          League
        </h1>
        <p className="text-lg text-gray-500 max-w-lg mx-auto mb-8">
          Predict every playoff series, score points for upsets, and compete with friends on the leaderboard.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          {isAuthenticated ? (
            <>
              <Link to="/leagues" className="btn-primary text-base px-6 py-3">
                My Leagues
              </Link>
              <Link to="/bracket" className="btn-outline text-base px-6 py-3">
                View Bracket
              </Link>
            </>
          ) : (
            <>
              <Link to="/register" className="btn-primary text-base px-6 py-3">
                Get Started
              </Link>
              <Link to="/bracket" className="btn-outline text-base px-6 py-3">
                View Bracket
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      {totalSeries > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Series', value: totalSeries },
            { label: 'Active Series', value: activeSeries },
            { label: 'Completed', value: completedSeries },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <p className="text-3xl font-bold text-nba-blue">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* How it works */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              step: '1',
              icon: '🏆',
              title: 'Join a League',
              desc: 'Create or join a private/public league with your friends using a 6-character invite code.',
            },
            {
              step: '2',
              icon: '📝',
              title: 'Make Predictions',
              desc: 'For each series, pick the winner and the final series score (e.g. 4-2). Submit before the deadline.',
            },
            {
              step: '3',
              icon: '⭐',
              title: 'Earn Points',
              desc: 'Score more points for picking upsets. Bonus points for nailing the exact series length.',
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="text-4xl mb-3">{item.icon}</div>
              <h3 className="font-bold text-gray-800 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scoring explainer */}
      <div className="bg-nba-blue text-white rounded-2xl p-8">
        <h2 className="text-xl font-bold mb-4">Scoring Formula</h2>
        <div className="font-mono text-sm bg-white/10 rounded-lg p-4 space-y-1">
          <p>implied_prob  = 1 / decimal_odds</p>
          <p>winner_points = BASE_WIN_POINTS × (1 − implied_prob)</p>
          <p>score_bonus   = EXACT_SCORE_BONUS  (if winner + score correct)</p>
        </div>
        <p className="text-sm text-blue-200 mt-3">
          Picking the underdog earns more points. Odds are frozen at the prediction deadline.
        </p>
      </div>
    </div>
  );
}
