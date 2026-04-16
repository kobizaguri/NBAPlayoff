import { PlayoffSeries, Prediction } from '../../types';
import { BracketColumn } from './BracketColumn';
import { BracketSlot } from './BracketSlot';

interface BracketTreeProps {
  series: PlayoffSeries[];
  predictionMap: Map<string, Prediction>;
  onSelect: (s: PlayoffSeries) => void;
  baseWinPoints?: number;
  playInWinPoints?: number;
}

/**
 * Full horizontal bracket tree:
 *   [East R1] [East Semis] [East Finals] [NBA Finals] [West Finals] [West Semis] [West R1]
 */
export function BracketTree({ series, predictionMap, onSelect, baseWinPoints, playInWinPoints }: BracketTreeProps) {
  const east = {
    firstRound: series.filter((s) => s.round === 'firstRound' && s.conference === 'east'),
    semis: series.filter((s) => s.round === 'semis' && s.conference === 'east'),
    finals: series.filter((s) => s.round === 'finals' && s.conference === 'east'),
  };

  const west = {
    firstRound: series.filter((s) => s.round === 'firstRound' && s.conference === 'west'),
    semis: series.filter((s) => s.round === 'semis' && s.conference === 'west'),
    finals: series.filter((s) => s.round === 'finals' && s.conference === 'west'),
  };

  const finalsSeries: PlayoffSeries | null =
    series.find((s) => s.round === 'nbaFinals') ?? null;

  return (
    <div className="overflow-x-auto pb-2 -mx-1 sm:-mx-2">
      <div className="flex items-stretch min-h-[480px] w-full min-w-0">
        {/* Conference headers row handled inside columns via label */}

        {/* East conference label */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="text-center mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-700">
              Eastern Conference
            </span>
          </div>
          <div className="flex flex-1 min-w-0">
            <BracketColumn
              side="east"
              rounds={east}
              predictionMap={predictionMap}
              onSelect={onSelect}
              baseWinPoints={baseWinPoints}
              playInWinPoints={playInWinPoints}
            />
          </div>
        </div>

        {/* NBA Finals — center column */}
        <div className="flex flex-col w-36 sm:w-40 shrink-0 px-1 sm:px-2">
          <div className="text-center mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-yellow-600">
              NBA Finals
            </span>
          </div>
          {/* Round label spacer to match column headers inside BracketColumn */}
          <div className="text-center mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 invisible">
              spacer
            </span>
          </div>
          <div className="flex flex-col flex-1 justify-center">
            <div className="border-2 border-yellow-400 rounded-lg p-0.5">
              <BracketSlot
                series={finalsSeries}
                side="east"
                noConnector
                prediction={finalsSeries ? predictionMap.get(finalsSeries.id) : undefined}
                onSelect={onSelect}
                baseWinPoints={baseWinPoints}
                playInWinPoints={playInWinPoints}
              />
            </div>
          </div>
        </div>

        {/* West conference label */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="text-center mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-red-700">
              Western Conference
            </span>
          </div>
          <div className="flex flex-1 min-w-0">
            <BracketColumn
              side="west"
              rounds={west}
              predictionMap={predictionMap}
              onSelect={onSelect}
              baseWinPoints={baseWinPoints}
              playInWinPoints={playInWinPoints}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
