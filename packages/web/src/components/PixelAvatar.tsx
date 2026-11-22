/** Deterministic 8x8 pixel-art avatar (mirrored), a placeholder until a real picture is added. */
export function PixelAvatar({ seed, size = 96 }: { seed: string; size?: number }) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rnd = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
  const cells: boolean[][] = Array.from({ length: 8 }, () => {
    const half = Array.from({ length: 4 }, () => rnd() > 0.45);
    return [...half, ...[...half].reverse()];
  });
  const accent = rnd() > 0.5 ? '#0ac18e' : '#111111';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Avatar placeholder for ${seed}`}
    >
      <rect width="8" height="8" fill="#f4f4f2" />
      {cells.map((row, y) =>
        row.map((on, x) =>
          on ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={y % 3 === 1 ? accent : '#111'} /> : null,
        ),
      )}
    </svg>
  );
}
