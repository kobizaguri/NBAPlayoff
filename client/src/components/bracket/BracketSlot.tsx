import { PlayoffSeries, Prediction } from '../../types';
import { SeriesCard } from './SeriesCard';
import { ConnectorLine } from './ConnectorLine';

interface BracketSlotProps {
  series: PlayoffSeries | null;
  side: 'east' | 'west';
  isTop?: boolean;
  isBottom?: boolean;
  noConnector?: boolean;
  prediction?: Prediction;
  onSelect?: (s: PlayoffSeries) => void;
  baseWinPoints?: number;
  playInWinPoints?: number;
}

/** A placeholder rendered when a series slot has not been created yet. */
function EmptySlot() {
  return (
    <div className="w-full h-full min-h-[88px] rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
      <span className="text-xs text-gray-400">TBD</span>
    </div>
  );
}

/**
 * A single matchup cell in the bracket tree.
 * Renders SeriesCard (or a placeholder) plus optional bracket connector lines.
 */
export function BracketSlot({
  series,
  side,
  isTop = false,
  isBottom = false,
  noConnector = false,
  prediction,
  onSelect,
  baseWinPoints,
  playInWinPoints,
}: BracketSlotProps) {
  const showConnector = !noConnector && (isTop || isBottom);

  return (
    <div className="relative w-full min-w-0">
      {series ? (
        <SeriesCard
          series={series}
          prediction={prediction}
          onClick={onSelect ? () => onSelect(series) : undefined}
          baseWinPoints={baseWinPoints}
          playInWinPoints={playInWinPoints}
        />
      ) : (
        <EmptySlot />
      )}
      {showConnector && (
        <ConnectorLine side={side} isTop={isTop} />
      )}
    </div>
  );
}
