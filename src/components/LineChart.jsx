// simple line chart for demographic time series in the right sidebar

export default function LineChart({ data, label, unit, color, selectedPeriods, intervalMode }) {
  if (!data || !Object.keys(data).length) {
    return <div style={{ padding: "12px 0", color: "#8a857a", fontSize: 13, fontStyle: "italic" }}>No {label.toLowerCase()} data available</div>;
  }

  // each selected period is a window — show both start and end year for demographics
  const step = intervalMode === "10yr" ? 10 : 5;
  const yearSet = new Set();
  for (const p of selectedPeriods) {
    yearSet.add(p);
    yearSet.add(String(+p + step));
  }
  const years = [...yearSet].sort((a, b) => +a - +b).filter(y => data[y] != null);
  if (!years.length) {
    return <div style={{ padding: "12px 0", color: "#8a857a", fontSize: 13, fontStyle: "italic" }}>No {label.toLowerCase()} data for selected periods</div>;
  }

  const W = 370, H = 140;
  const pad = { t: 22, r: 16, b: 26, l: 38 };
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;

  const vals = years.map(y => data[y]);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const yLo = Math.max(0, lo - span * 0.1), yHi = hi + span * 0.1;

  const nums = years.map(Number);
  const xLo = nums[0], xHi = nums[nums.length - 1], xSpan = xHi - xLo || 1;
  const xOf = n => years.length === 1 ? pad.l + pw / 2 : pad.l + ((n - xLo) / xSpan) * pw;
  const yOf = v => pad.t + ph - ((v - yLo) / (yHi - yLo)) * ph;

  const pts = years.map(y => ({ x: xOf(+y), y: yOf(data[y]), v: data[y], yr: y }));
  const linePath = pts.map((p, i) => (i ? "L" : "M") + p.x + "," + p.y).join(" ");
  const areaPath = linePath + `L${pts[pts.length - 1].x},${pad.t + ph}L${pts[0].x},${pad.t + ph}Z`;

  const ticks = Array.from({ length: 5 }, (_, i) => {
    const v = yLo + (i / 4) * (yHi - yLo);
    return { v, y: yOf(v) };
  });

  const fmt = v => v < 10 ? v.toFixed(1) : Math.round(v).toString();

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: "#8a857a", marginBottom: 6, fontFamily: "'Source Sans 3', sans-serif", letterSpacing: "0.03em", textTransform: "uppercase" }}>
        {label}{unit ? ` (${unit})` : ""}
      </div>
      <svg width={W} height={H} style={{ display: "block" }}>
        {ticks.map((t, i) => <line key={i} x1={pad.l} x2={W - pad.r} y1={t.y} y2={t.y} stroke="#e8e4dc" strokeWidth={0.5} />)}
        {ticks.map((t, i) => <text key={"t" + i} x={pad.l - 6} y={t.y + 3} textAnchor="end" fontSize={8} fill="#a9a49a" fontFamily="'Source Sans 3'">{fmt(t.v)}</text>)}

        {pts.length > 1 && <path d={areaPath} fill={color} opacity={0.08} />}
        {pts.length > 1 && <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}

        {pts.map(p => (
          <g key={p.yr}>
            <circle cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke={color} strokeWidth={2} />
            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={9} fill="#3d3a35" fontFamily="'Source Sans 3'" fontWeight={600}>{fmt(p.v)}</text>
            <text x={p.x} y={H - 6} textAnchor="middle" fontSize={8} fill="#3d3a35" fontFamily="'Source Sans 3'">{"'" + p.yr.slice(2)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}