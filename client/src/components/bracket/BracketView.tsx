import { useState } from 'react';
import { PlayoffSeries, Prediction, SeriesRound } from '../../types';
import { SeriesCard } from './SeriesCard';
import { PredictionPanel } from './PredictionPanel';
import { useAuthStore } from '../../store/authStore';

interface Props {
  series: PlayoffSeries[];
  predictions?: Prediction[];
  leagueId?: string;
}

const ROUND_ORDER: SeriesRound[] = ['firstRound', 'semis', 'finals', 'nbaFinals'];
const ROUND_LABELS: Record<SeriesRound, string> = {
  firstRound: 'First Round',
  semis: 'Conference Semifinals',
  finals: 'Conference Finals',
  nbaFinals: 'NBA Finals',
};

export function BracketView({ series, predictions = [], leagueId }: Props) {
  const { isAuthenticated } = useAuthStore();
  const [selectedSeries, setSelectedSeries] = useState<PlayoffSeries | null>(null);

  const predictionMap = new Map(predictions.map((p) => [p.seriesId, p]));

  const seriesByRound = ROUND_ORDER.map((round) => ({
    round,
    label: ROUND_LABELS[round],
    east: series
      .filter((s) => s.round === round && s.conference === 'east')
      .sort((a, b) => a.homeTeamSeed - b.homeTeamSeed),
    west: series
      .filter((s) => s.round === round && s.conference === 'west')
      .sort((a, b) => a.homeTeamSeed - b.homeTeamSeed),
    finals: series.filter((s) => s.round === round && s.conference === 'finals'),
  }));

  return (
    <div className="space-y-8">
      {seriesByRound.map(({ round, label, east, west, finals }) => {
        const hasContent = east.length > 0 || west.length > 0 || finals.length > 0;
        if (!hasContent) return null;

        return (
          <section key={round}>
            <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-5 bg-nba-blue rounded-full inline-block" />
              {label}
            </h2>

            {round === 'nbaFinals' ? (
              <div className="max-w-sm mx-auto">
                {finals.map((s) => (
                  <SeriesCard
                    key={s.id}
                    series={s}
                    prediction={predictionMap.get(s.id)}
                    onClick={isAuthenticated ? () => setSelectedSeries(s) : undefined}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* East */}
                {east.length > 0 && (
                  <div>
                    {east.length > 0 && (
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Eastern Conference
                      </h3>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {east.map((s) => (
                        <SeriesCard
                          key={s.id}
                          series={s}
                          prediction={predictionMap.get(s.id)}
                          onClick={isAuthenticated ? () => setSelectedSeries(s) : undefined}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* West */}
                {west.length > 0 && (
                  <div>
                    {west.length > 0 && (
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Western Conference
                      </h3>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {west.map((s) => (
                        <SeriesCard
                          key={s.id}
                          series={s}
                          prediction={predictionMap.get(s.id)}
                          onClick={isAuthenticated ? () => setSelectedSeries(s) : undefined}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}

      {series.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-4">🏀</p>
          <p className="text-lg font-medium">No bracket data yet</p>
          <p className="text-sm">The admin will add series when the playoffs begin.</p>
        </div>
      )}

      {/* Prediction modal */}
      {selectedSeries && leagueId && (
        <PredictionPanel
          series={selectedSeries}
          leagueId={leagueId}
          existingPrediction={predictionMap.get(selectedSeries.id)}
          onClose={() => setSelectedSeries(null)}
        />
      )}
    </div>
  );
}
