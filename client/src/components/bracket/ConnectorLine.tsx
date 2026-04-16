interface ConnectorLineProps {
  side: 'east' | 'west';
  isTop: boolean; // true = top card of a pair, false = bottom card of a pair
}

/**
 * Draws the bracket connector line on the right (east) or left (west) side of a card.
 * - For the top card: draws a border on the right/left edge + bottom half
 * - For the bottom card: draws a border on the right/left edge + top half
 * Together they form a ┐└ bracket connecting to the next-round card.
 */
export function ConnectorLine({ side, isTop }: ConnectorLineProps) {
  const isEast = side === 'east';

  return (
    <div
      className="absolute top-0 bottom-0 w-4 pointer-events-none"
      style={{ [isEast ? 'right' : 'left']: '-1rem' }}
    >
      {/* Vertical segment: only half-height, top half or bottom half */}
      <div
        className="absolute w-0 border-gray-300"
        style={{
          [isEast ? 'right' : 'left']: 0,
          top: isTop ? '50%' : 0,
          bottom: isTop ? 0 : '50%',
          borderLeftWidth: isEast ? 0 : '1px',
          borderRightWidth: isEast ? '1px' : 0,
        }}
      />
      {/* Horizontal nub at the mid-point connecting to the vertical */}
      <div
        className="absolute border-gray-300"
        style={{
          [isEast ? 'right' : 'left']: 0,
          top: '50%',
          width: '1rem',
          borderTopWidth: '1px',
        }}
      />
    </div>
  );
}
