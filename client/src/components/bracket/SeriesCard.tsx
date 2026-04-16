import { PlayoffSeries, Prediction } from '../../types';

function mlToRawProb(odds: number) {
  return odds < 0 ? (-odds) / (-odds + 100) : 100 / (odds + 100);
}

function calcPts(odds: number, homeOdds: number, awayOdds: number, base: number): number {
  const rawHome = mlToRawProb(homeOdds);
  const rawAway = mlToRawProb(awayOdds);
  const total = rawHome + rawAway;
  const prob = mlToRawProb(odds) / total;
  return Math.round(base * (1 - prob));
}

interface Props {
  series: PlayoffSeries;
  prediction?: Prediction;
  onClick?: () => void;
  baseWinPoints?: number;
  playInWinPoints?: number;
}

function statusBadge(series: PlayoffSeries) {
  const locked = series.isLockedManually || new Date(series.deadline) <= new Date();
  if (series.status === 'complete') return <span className="badge bg-gray-600">Final</span>;
  if (locked) return <span className="badge bg-nba-red">Locked</span>;
  if (series.status === 'active') return <span className="badge bg-green-600">Live</span>;
  return <span className="badge bg-yellow-600">Open</span>;
}

export function SeriesCard({ series, prediction, onClick, baseWinPoints, playInWinPoints }: Props) {
  // Per-series winPoints override takes priority over league defaults
  const effectiveBase = series.winPoints ?? (series.round === 'playIn' ? playInWinPoints : baseWinPoints);

  const homeIsWinner = series.winnerId === series.homeTeamId;
  const awayIsWinner = series.winnerId === series.awayTeamId;

  const userPickedHome = prediction?.predictedWinnerId === series.homeTeamId;
  const userPickedAway = prediction?.predictedWinnerId === series.awayTeamId;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-w-0 text-left bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-nba-blue transition-all p-2 sm:p-2.5 group"
    >
      <div className="flex items-center justify-between gap-1 mb-1.5 min-w-0">
        {statusBadge(series)}
        {prediction && (
          <span className="text-[10px] sm:text-xs text-gray-500 shrink-0 truncate max-w-[42%] text-right">
            {prediction.isLocked && prediction.totalPoints > 0
              ? <span className="text-green-600 font-bold">+{prediction.totalPoints.toFixed(1)}</span>
              : <span className="text-blue-600">Pred.</span>}
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

      {/* Bottom row: pts per team (league view) or ML odds (public view) */}
      <div className="flex justify-between gap-1 mt-1.5 border-t border-gray-100 pt-1 min-w-0">
        {effectiveBase !== undefined ? (
          <>
            <span className="text-[10px] sm:text-xs text-nba-blue font-semibold truncate max-w-[48%]">
              {series.homeTeamName.split(' ').pop()}: {calcPts(series.homeOdds, series.homeOdds, series.awayOdds, effectiveBase)}pts
            </span>
            <span className="text-[10px] sm:text-xs text-nba-blue font-semibold truncate max-w-[48%] text-right">
              {series.awayTeamName.split(' ').pop()}: {calcPts(series.awayOdds, series.homeOdds, series.awayOdds, effectiveBase)}pts
            </span>
          </>
        ) : (
          <>
            <span className="text-[10px] sm:text-xs text-gray-400 truncate max-w-[48%]">
              {series.homeTeamName.split(' ').pop()}: {series.homeOdds > 0 ? `+${series.homeOdds}` : series.homeOdds}
            </span>
            <span className="text-[10px] sm:text-xs text-gray-400 truncate max-w-[48%] text-right">
              {series.awayTeamName.split(' ').pop()}: {series.awayOdds > 0 ? `+${series.awayOdds}` : series.awayOdds}
            </span>
          </>
        )}
      </div>
    </button>
  );
}
