/**
 * Line chart component for displaying time series data.
 * Each selected migration period represents a window (5yr or 10yr),
 * so the chart plots both endpoints for demographic data.
 */
export default function LineChart({ data, label, unit, color, selectedPeriods, intervalMode }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div style={{ padding: "12px 0", color: "#8a857a", fontSize: 13, fontStyle: "italic" }}>
        No {label.toLowerCase()} data available
      </div>
    );
  }

  // Expand each selected period into its start and end year
  const step = intervalMode === "10yr" ? 10 : 5;
  const yearSet = new Set();
  for (const p of selectedPeriods) {
    yearSet.add(p);
    yearSet.add(String(parseInt(p) + step));
  }

  // Sort and filter to only years that have data
  const activeYears = Array.from(yearSet)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .filter(y => data[y] != null);

  if (activeYears.length === 0) {
    return (
      <div style={{ padding: "12px 0", color: "#8a857a", fontSize: 13, fontStyle: "italic" }}>
        No {label.toLowerCase()} data for selected periods
      </div>
    );
  }

  const W = 370, H = 140;
  const PAD = { top: 22, right: 16, bottom: 26, left: 38 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const values = activeYears.map(y => data[y]);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const yMin = Math.max(0, minVal - range * 0.1);
  const yMax = maxVal + range * 0.1;

  // X scale: position years proportionally by actual year value
  const yearNums = activeYears.map(y => parseInt(y));
  const xMin = yearNums[0];
  const xMax = yearNums[yearNums.length - 1];
  const xRange = xMax - xMin || 1;

  const getX = (yearNum) => {
    if (activeYears.length === 1) return PAD.left + plotW / 2;
    return PAD.left + ((yearNum - xMin) / xRange) * plotW;
  };

  const getY = (val) => {
    return PAD.top + plotH - ((val - yMin) / (yMax - yMin)) * plotH;
  };

  // Build points
  const points = activeYears.map(y => ({
    x: getX(parseInt(y)),
    y: getY(data[y]),
    val: data[y],
    label: y
  }));

  // SVG line path
  const linePath = points.map((pt, i) =>
    (i === 0 ? "M" : "L") + `${pt.x},${pt.y}`
  ).join(" ");

  // Area path
  const areaPath = linePath
    + ` L${points[points.length - 1].x},${PAD.top + plotH}`
    + ` L${points[0].x},${PAD.top + plotH} Z`;

  // Y-axis ticks
  const tickCount = 4;
  const yTicks = [];
  for (let i = 0; i <= tickCount; i++) {
    const val = yMin + (i / tickCount) * (yMax - yMin);
    yTicks.push({ val, y: getY(val) });
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 12,
        color: "#8a857a",
        marginBottom: 6,
        fontFamily: "'Source Sans 3', sans-serif",
        letterSpacing: "0.03em",
        textTransform: "uppercase"
      }}>
        {label}{unit ? ` (${unit})` : ""}
      </div>
      <svg width={W} height={H} style={{ display: "block" }}>
        {/* Horizontal grid lines */}
        {yTicks.map((tick, i) => (
          <line
            key={i}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={tick.y}
            y2={tick.y}
            stroke="#e8e4dc"
            strokeWidth={0.5}
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <text
            key={`yl-${i}`}
            x={PAD.left - 6}
            y={tick.y + 3}
            textAnchor="end"
            fontSize={8}
            fill="#a9a49a"
            fontFamily="'Source Sans 3', sans-serif"
          >
            {tick.val < 10 ? tick.val.toFixed(1) : Math.round(tick.val)}
          </text>
        ))}

        {/* Area fill */}
        {points.length > 1 && (
          <path
            d={areaPath}
            fill={color}
            opacity={0.08}
          />
        )}

        {/* Line */}
        {points.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Data points and labels */}
        {points.map((pt) => (
          <g key={pt.label}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r={3.5}
              fill="#fff"
              stroke={color}
              strokeWidth={2}
            />
            {/* Value label above point */}
            <text
              x={pt.x}
              y={pt.y - 8}
              textAnchor="middle"
              fontSize={9}
              fill="#3d3a35"
              fontFamily="'Source Sans 3', sans-serif"
              fontWeight={600}
            >
              {pt.val < 10 ? pt.val.toFixed(1) : Math.round(pt.val)}
            </text>
            {/* Year label below */}
            <text
              x={pt.x}
              y={H - 6}
              textAnchor="middle"
              fontSize={8}
              fill="#3d3a35"
              fontFamily="'Source Sans 3', sans-serif"
              fontWeight={400}
            >
              {"'" + pt.label.slice(2)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
