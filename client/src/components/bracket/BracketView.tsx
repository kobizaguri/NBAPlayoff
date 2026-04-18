import { useState } from 'react';
import { PlayoffSeries, Prediction, SeriesRound } from '../../types';
import { SeriesCard } from './SeriesCard';
import { PredictionPanel } from './PredictionPanel';
import { BracketTree } from './BracketTree';
import { useAuthStore } from '../../store/authStore';

interface Props {
  series: PlayoffSeries[];
  predictions?: Prediction[];
  leagueId?: string;
  baseWinPoints?: number;
  playInWinPoints?: number;
}

const ROUND_ORDER: SeriesRound[] = ['firstRound', 'semis', 'finals', 'nbaFinals'];
const ROUND_LABELS: Record<SeriesRound, string> = {
  playIn: 'Play-In Tournament',
  firstRound: 'First Round',
  semis: 'Conference Semifinals',
  finals: 'Conference Finals',
  nbaFinals: 'NBA Finals',
};

// ─── Play-In Banner ──────────────────────────────────────────────────────────

interface PlayInBannerProps {
  east: PlayoffSeries[];
  west: PlayoffSeries[];
  predictionMap: Map<string, Prediction>;
  isAuthenticated: boolean;
  onSelect: (s: PlayoffSeries) => void;
  baseWinPoints?: number;
  playInWinPoints?: number;
}

function PlayInBanner({ east, west, predictionMap, isAuthenticated, onSelect, baseWinPoints, playInWinPoints }: PlayInBannerProps) {
  if (east.length === 0 && west.length === 0) return null;
  return (
    <section className="min-w-0">
      <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-2 sm:mb-3 flex items-center gap-2">
        <span className="w-1 h-5 bg-orange-500 rounded-full inline-block shrink-0" />
        <span className="leading-snug">{ROUND_LABELS.playIn}</span>
      </h2>
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-3 sm:p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
        {east.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Eastern Conference
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {east.map((s) => (
                <SeriesCard
                  key={s.id}
                  series={s}
                  prediction={predictionMap.get(s.id)}
                  onClick={isAuthenticated ? () => onSelect(s) : undefined}
                  baseWinPoints={baseWinPoints}
                  playInWinPoints={playInWinPoints}
                />
              ))}
            </div>
          </div>
        )}
        {west.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Western Conference
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {west.map((s) => (
                <SeriesCard
                  key={s.id}
                  series={s}
                  prediction={predictionMap.get(s.id)}
                  onClick={isAuthenticated ? () => onSelect(s) : undefined}
                  baseWinPoints={baseWinPoints}
                  playInWinPoints={playInWinPoints}
                />
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
    </section>
  );
}

// ─── Mobile fallback (stacked round-by-round list) ───────────────────────────

interface MobileBracketProps {
  series: PlayoffSeries[];
  predictionMap: Map<string, Prediction>;
  isAuthenticated: boolean;
  onSelect: (s: PlayoffSeries) => void;
  baseWinPoints?: number;
  playInWinPoints?: number;
}

function MobileBracket({ series, predictionMap, isAuthenticated, onSelect, baseWinPoints, playInWinPoints }: MobileBracketProps) {
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
    <div className="space-y-5 sm:space-y-6 md:space-y-8">
      {seriesByRound.map(({ round, label, east, west, finals }) => {
        const hasContent = east.length > 0 || west.length > 0 || finals.length > 0;
        if (!hasContent) return null;
        return (
          <section key={round} className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-2 sm:mb-3 flex items-center gap-2">
              <span className="w-1 h-5 bg-nba-blue rounded-full inline-block shrink-0" />
              <span className="leading-snug">{label}</span>
            </h2>
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-3 sm:p-4 min-w-0">
              {round === 'nbaFinals' ? (
                <div className="max-w-md mx-auto">
                  {finals.map((s) => (
                    <SeriesCard
                      key={s.id}
                      series={s}
                      prediction={predictionMap.get(s.id)}
                      onClick={isAuthenticated ? () => onSelect(s) : undefined}
                      baseWinPoints={baseWinPoints}
                      playInWinPoints={playInWinPoints}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                  {east.length > 0 && (
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Eastern Conference
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {east.map((s) => (
                          <SeriesCard
                            key={s.id}
                            series={s}
                            prediction={predictionMap.get(s.id)}
                            onClick={isAuthenticated ? () => onSelect(s) : undefined}
                            baseWinPoints={baseWinPoints}
                            playInWinPoints={playInWinPoints}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {west.length > 0 && (
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Western Conference
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {west.map((s) => (
                          <SeriesCard
                            key={s.id}
                            series={s}
                            prediction={predictionMap.get(s.id)}
                            onClick={isAuthenticated ? () => onSelect(s) : undefined}
                            baseWinPoints={baseWinPoints}
                            playInWinPoints={playInWinPoints}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ─── Main BracketView ────────────────────────────────────────────────────────

export function BracketView({ series, predictions = [], leagueId, baseWinPoints, playInWinPoints }: Props) {
  const { isAuthenticated } = useAuthStore();
  const [selectedSeries, setSelectedSeries] = useState<PlayoffSeries | null>(null);

  const predictionMap = new Map(predictions.map((p) => [p.seriesId, p]));

  const playInEast = series
    .filter((s) => s.round === 'playIn' && s.conference === 'east')
    .sort((a, b) => a.homeTeamSeed - b.homeTeamSeed);
  const playInWest = series
    .filter((s) => s.round === 'playIn' && s.conference === 'west')
    .sort((a, b) => a.homeTeamSeed - b.homeTeamSeed);

  const handleSelect = isAuthenticated ? (s: PlayoffSeries) => setSelectedSeries(s) : () => {};

  const bracketSeries = series.filter((s) => s.round !== 'playIn');

  return (
    <div className="space-y-5 sm:space-y-6 md:space-y-8 min-w-0">
      {/* Play-In Banner — always visible */}
      <PlayInBanner
        east={playInEast}
        west={playInWest}
        predictionMap={predictionMap}
        isAuthenticated={isAuthenticated}
        onSelect={handleSelect}
        baseWinPoints={baseWinPoints}
        playInWinPoints={playInWinPoints}
      />

      {series.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-4">🏀</p>
          <p className="text-lg font-medium">No bracket data yet</p>
          <p className="text-sm">The admin will add series when the playoffs begin.</p>
        </div>
      )}

      {/* Desktop: horizontal bracket tree (≥1024px) */}
      {bracketSeries.length > 0 && (
        <div className="hidden lg:block">
          <BracketTree
            series={bracketSeries}
            predictionMap={predictionMap}
            onSelect={handleSelect}
            baseWinPoints={baseWinPoints}
          />
        </div>
      )}

      {/* Mobile / tablet: stacked round-by-round list (<1024px) */}
      {bracketSeries.length > 0 && (
        <div className="lg:hidden space-y-4 min-w-0">
          {leagueId && isAuthenticated && (
            <p className="text-sm text-gray-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 leading-snug">
              Tap a matchup to add or change your prediction.
            </p>
          )}
          <MobileBracket
            series={bracketSeries}
            predictionMap={predictionMap}
            isAuthenticated={isAuthenticated}
            onSelect={handleSelect}
            baseWinPoints={baseWinPoints}
            playInWinPoints={playInWinPoints}
          />
        </div>
      )}

      {/* Prediction modal */}
      {selectedSeries && leagueId && (
        <PredictionPanel
          series={selectedSeries}
          leagueId={leagueId}
          existingPrediction={predictionMap.get(selectedSeries.id)}
          onClose={() => setSelectedSeries(null)}
          baseWinPoints={baseWinPoints}
          playInWinPoints={playInWinPoints}
        />
      )}
    </div>
  );
}
