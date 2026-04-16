import { PlayoffSeries, Prediction } from '../../types';
import { BracketSlot } from './BracketSlot';

interface RoundData {
  firstRound: PlayoffSeries[]; // 4 series, seed-ordered
  semis: PlayoffSeries[];      // 2 series
  finals: PlayoffSeries[];     // 1 series
}

interface BracketColumnProps {
  side: 'east' | 'west';
  rounds: RoundData;
  predictionMap: Map<string, Prediction>;
  onSelect: (s: PlayoffSeries) => void;
  baseWinPoints?: number;
  playInWinPoints?: number;
}

const ROUND_LABELS = {
  firstRound: 'First Round',
  semis: 'Semifinals',
  finals: 'Conf. Finals',
};

/**
 * Seed ordering for First Round slot positions.
 * Slots 0+1 feed into Semis slot 0; slots 2+3 feed into Semis slot 1.
 *   slot 0: 1v8
 *   slot 1: 4v5
 *   slot 2: 2v7
 *   slot 3: 3v6
 */
const FIRST_ROUND_SEED_ORDER = [
  [1, 8],
  [4, 5],
  [2, 7],
  [3, 6],
];

/** Sort series into the canonical seed-pair order */
function sortedBySlot(seriesList: PlayoffSeries[]): (PlayoffSeries | null)[] {
  return FIRST_ROUND_SEED_ORDER.map(([high, low]) => {
    return (
      seriesList.find(
        (s) =>
          (s.homeTeamSeed === high && s.awayTeamSeed === low) ||
          (s.homeTeamSeed === low && s.awayTeamSeed === high) ||
          (s.homeTeamSeed === high || s.awayTeamSeed === high) // fallback by high seed
      ) ?? null
    );
  });
}

/**
 * Sort semis by which half of the bracket they belong to.
 * Semis slot 0 = winner of slots 0+1 (1v8, 4v5 → lower seeds)
 * Semis slot 1 = winner of slots 2+3 (2v7, 3v6 → middle seeds)
 */
function sortedSemis(seriesList: PlayoffSeries[]): (PlayoffSeries | null)[] {
  // Slot 0: teams seeded 1,4,5,8 — lowest seeds
  // Slot 1: teams seeded 2,3,6,7
  const topHalf = seriesList.find(
    (s) =>
      Math.min(s.homeTeamSeed, s.awayTeamSeed) <= 2
  ) ?? null;
  const bottomHalf = seriesList.find(
    (s) =>
      Math.min(s.homeTeamSeed, s.awayTeamSeed) > 2 ||
      (s !== topHalf)
  ) ?? null;

  // Deduplicate: if both point to the same series pick the other
  if (topHalf && bottomHalf && topHalf.id === bottomHalf.id) {
    return [topHalf, null];
  }
  return [topHalf, bottomHalf];
}

/**
 * One conference's bracket columns: First Round → Semis → Conf Finals.
 * East: columns go left → right.
 * West: columns go right → left (flex-row-reverse applied by parent).
 */
export function BracketColumn({ side, rounds, predictionMap, onSelect, baseWinPoints, playInWinPoints }: BracketColumnProps) {
  const firstRoundSlots = sortedBySlot(rounds.firstRound);
  const semisSlots = sortedSemis(rounds.semis);
  const finalsSlot: PlayoffSeries | null = rounds.finals[0] ?? null;

  const columns = [
    { key: 'firstRound', label: ROUND_LABELS.firstRound },
    { key: 'semis', label: ROUND_LABELS.semis },
    { key: 'finals', label: ROUND_LABELS.finals },
  ];

  return (
    <div
      className={`flex ${side === 'west' ? 'flex-row-reverse' : 'flex-row'} flex-1 min-w-0`}
    >
      {/* First Round — 4 cards */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="text-center mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            {columns[0].label}
          </span>
        </div>
        <div className="flex flex-col flex-1 justify-around gap-1.5 sm:gap-2 px-0.5 sm:px-1 min-w-0">
          {firstRoundSlots.map((s, i) => (
            <BracketSlot
              key={s?.id ?? `fr-empty-${i}`}
              series={s}
              side={side}
              isTop={i % 2 === 0}
              isBottom={i % 2 === 1}
              prediction={s ? predictionMap.get(s.id) : undefined}
              onSelect={onSelect}
              baseWinPoints={baseWinPoints}
              playInWinPoints={playInWinPoints}
            />
          ))}
        </div>
      </div>

      {/* Semifinals — 2 cards */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="text-center mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            {columns[1].label}
          </span>
        </div>
        <div className="flex flex-col flex-1 justify-around gap-1.5 sm:gap-2 px-0.5 sm:px-1 min-w-0">
          {semisSlots.map((s, i) => (
            <BracketSlot
              key={s?.id ?? `semis-empty-${i}`}
              series={s}
              side={side}
              isTop={i === 0}
              isBottom={i === 1}
              prediction={s ? predictionMap.get(s.id) : undefined}
              onSelect={onSelect}
              baseWinPoints={baseWinPoints}
              playInWinPoints={playInWinPoints}
            />
          ))}
        </div>
      </div>

      {/* Conference Finals — 1 card */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="text-center mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            {columns[2].label}
          </span>
        </div>
        <div className="flex flex-col flex-1 justify-center px-0.5 sm:px-1 min-w-0">
          <BracketSlot
            key={finalsSlot?.id ?? 'finals-empty'}
            series={finalsSlot}
            side={side}
            noConnector
            prediction={finalsSlot ? predictionMap.get(finalsSlot.id) : undefined}
            onSelect={onSelect}
            baseWinPoints={baseWinPoints}
            playInWinPoints={playInWinPoints}
          />
        </div>
      </div>
    </div>
  );
}
