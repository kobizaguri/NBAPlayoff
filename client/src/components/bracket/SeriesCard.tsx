import { PlayoffSeries, Prediction } from '../../types';

interface Props {
  series: PlayoffSeries;
  prediction?: Prediction;
  onClick?: () => void;
}

function statusBadge(series: PlayoffSeries) {
  const locked = series.isLockedManually || new Date(series.deadline) <= new Date();
  if (series.status === 'complete') return <span className="badge bg-gray-600">Final</span>;
  if (locked) return <span className="badge bg-nba-red">Locked</span>;
  if (series.status === 'active') return <span className="badge bg-green-600">Live</span>;
  return <span className="badge bg-yellow-600">Open</span>;
}

export function SeriesCard({ series, prediction, onClick }: Props) {
  const homeWins = (series.winnerId === series.homeTeamId && series.finalSeriesScore)
    ? parseInt(series.finalSeriesScore.split('-')[0])
    : series.homeWins;
  const awayWins = (series.winnerId === series.awayTeamId && series.finalSeriesScore)
    ? parseInt(series.finalSeriesScore.split('-')[0])
    : series.awayWins;

  const homeIsWinner = series.winnerId === series.homeTeamId;
  const awayIsWinner = series.winnerId === series.awayTeamId;

  const userPickedHome = prediction?.predictedWinnerId === series.homeTeamId;
  const userPickedAway = prediction?.predictedWinnerId === series.awayTeamId;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-nba-blue transition-all p-3 group"
    >
      <div className="flex items-center justify-between mb-2">
        {statusBadge(series)}
        {prediction && (
          <span className="text-xs text-gray-500">
            {prediction.isLocked && prediction.totalPoints > 0
              ? <span className="text-green-600 font-bold">+{prediction.totalPoints}pts</span>
              : <span className="text-blue-600">Predicted</span>}
          </span>
        )}
      </div>

      {/* Home team */}
      <div className={`flex items-center justify-between py-1 ${homeIsWinner ? 'font-bold' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-gray-400 w-5 shrink-0">#{series.homeTeamSeed}</span>
          <span className={`text-sm truncate ${homeIsWinner ? 'text-gray-900' : 'text-gray-700'}`}>
            {series.homeTeamName}
          </span>
          {userPickedHome && (
            <span className="text-xs shrink-0">
              {homeIsWinner ? '✅' : series.status === 'complete' ? '❌' : '🔵'}
            </span>
          )}
        </div>
        <span className={`text-sm font-mono font-bold shrink-0 ml-1 ${homeIsWinner ? 'text-nba-blue' : 'text-gray-500'}`}>
          {homeIsWinner ? series.finalSeriesScore?.split('-')[0] : series.homeWins}
        </span>
      </div>

      {/* Away team */}
      <div className={`flex items-center justify-between py-1 ${awayIsWinner ? 'font-bold' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-gray-400 w-5 shrink-0">#{series.awayTeamSeed}</span>
          <span className={`text-sm truncate ${awayIsWinner ? 'text-gray-900' : 'text-gray-700'}`}>
            {series.awayTeamName}
          </span>
          {userPickedAway && (
            <span className="text-xs shrink-0">
              {awayIsWinner ? '✅' : series.status === 'complete' ? '❌' : '🔵'}
            </span>
          )}
        </div>
        <span className={`text-sm font-mono font-bold shrink-0 ml-1 ${awayIsWinner ? 'text-nba-blue' : 'text-gray-500'}`}>
          {awayIsWinner ? series.finalSeriesScore?.split('-')[0] : series.awayWins}
        </span>
      </div>

      {/* Odds row */}
      <div className="flex justify-between mt-2 border-t border-gray-100 pt-1">
        <span className="text-xs text-gray-400">
          {series.homeTeamName.split(' ').pop()}: {series.homeOdds.toFixed(2)}
        </span>
        <span className="text-xs text-gray-400">
          {series.awayTeamName.split(' ').pop()}: {series.awayOdds.toFixed(2)}
        </span>
      </div>
    </button>
  );
}
