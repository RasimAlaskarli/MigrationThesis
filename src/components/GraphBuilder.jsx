import { useState, useMemo } from 'react';
import { getName, formatNum } from '../utils/formatters';

const VARIABLES = [
  { key: "unemployment", label: "Unemployment", unit: "%", color: "#c2703e", source: "chart" },
  { key: "urbanization", label: "Urbanization", unit: "%", color: "#5a8a6a", source: "chart" },
  { key: "medianAge", label: "Median Age", unit: "yrs", color: "#6a7b8a", source: "chart" },
  { key: "immigration", label: "Immigration", unit: "", color: "#4878a8", source: "migration" },
  { key: "emigration", label: "Emigration", unit: "", color: "#c44e52", source: "migration" },
  { key: "netMigration", label: "Net Migration", unit: "", color: "#8a6a7b", source: "migration" },
];

/**
 * Dual Y-axis line chart with hover tooltips
 */
function DualAxisChart({ dataLeft, dataRight, varLeft, varRight, years }) {
  const [hovered, setHovered] = useState(null);

  const W = 460, H = 280;
  const PAD = { top: 30, right: 55, bottom: 32, left: 55 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  if (years.length === 0) {
    return (
      <div style={{ padding: 20, color: "#8a857a", fontSize: 13, fontStyle: "italic", textAlign: "center" }}>
        No data available for the selected variables and periods
      </div>
    );
  }

  const yearNums = years.map(y => parseInt(y));
  const xMin = yearNums[0];
  const xMax = yearNums[yearNums.length - 1];
  const xRange = xMax - xMin || 1;

  const getX = (yr) => {
    if (years.length === 1) return PAD.left + plotW / 2;
    return PAD.left + ((parseInt(yr) - xMin) / xRange) * plotW;
  };

  // Left Y scale
  const leftVals = years.map(y => dataLeft?.[y]).filter(v => v != null);
  const leftMin = leftVals.length ? Math.min(...leftVals) : 0;
  const leftMax = leftVals.length ? Math.max(...leftVals) : 1;
  const leftRange = leftMax - leftMin || 1;
  const leftYMin = leftMin - leftRange * 0.1;
  const leftYMax = leftMax + leftRange * 0.1;
  const getYLeft = (v) => PAD.top + plotH - ((v - leftYMin) / (leftYMax - leftYMin)) * plotH;

  // Right Y scale
  const rightVals = years.map(y => dataRight?.[y]).filter(v => v != null);
  const rightMin = rightVals.length ? Math.min(...rightVals) : 0;
  const rightMax = rightVals.length ? Math.max(...rightVals) : 1;
  const rightRange = rightMax - rightMin || 1;
  const rightYMin = rightMin - rightRange * 0.1;
  const rightYMax = rightMax + rightRange * 0.1;
  const getYRight = (v) => PAD.top + plotH - ((v - rightYMin) / (rightYMax - rightYMin)) * plotH;

  // Build points
  const leftPoints = years.filter(y => dataLeft?.[y] != null).map(y => ({ x: getX(y), y: getYLeft(dataLeft[y]), val: dataLeft[y], yr: y }));
  const rightPoints = years.filter(y => dataRight?.[y] != null).map(y => ({ x: getX(y), y: getYRight(dataRight[y]), val: dataRight[y], yr: y }));

  const makePath = (pts) => pts.map((p, i) => (i === 0 ? "M" : "L") + `${p.x},${p.y}`).join(" ");

  const makeYTicks = (yMin, yMax, count = 4) => {
    const ticks = [];
    for (let i = 0; i <= count; i++) ticks.push(yMin + (i / count) * (yMax - yMin));
    return ticks;
  };

  const leftTicks = makeYTicks(leftYMin, leftYMax);
  const rightTicks = makeYTicks(rightYMin, rightYMax);

  const formatTick = (v) => {
    if (Math.abs(v) >= 1000000) return (v / 1000000).toFixed(1) + "M";
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(0) + "K";
    if (Math.abs(v) < 10) return v.toFixed(1);
    return Math.round(v).toString();
  };

  const formatVal = (v, unit) => {
    if (v == null) return "—";
    if (Math.abs(v) >= 1000000) return (v / 1000000).toFixed(2) + "M";
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + "K";
    if (unit === "%" || unit === "yrs") return v.toFixed(1) + (unit === "%" ? "%" : " yrs");
    return v.toLocaleString();
  };

  // Find closest year for hover
  const handleMouseMove = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    let closest = null;
    let closestDist = Infinity;
    for (const yr of years) {
      const x = getX(yr);
      const dist = Math.abs(mouseX - x);
      if (dist < closestDist) {
        closestDist = dist;
        closest = yr;
      }
    }
    if (closestDist < 30) {
      setHovered(closest);
    } else {
      setHovered(null);
    }
  };

  const hoveredX = hovered ? getX(hovered) : null;

  return (
    <svg
      width={W}
      height={H}
      style={{ display: "block", cursor: "crosshair" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHovered(null)}
    >
      {/* Grid lines */}
      {leftTicks.map((v, i) => (
        <line key={`grid-${i}`} x1={PAD.left} x2={W - PAD.right} y1={getYLeft(v)} y2={getYLeft(v)} stroke="#e8e4dc" strokeWidth={0.5} />
      ))}

      {/* Left Y-axis labels */}
      {leftTicks.map((v, i) => (
        <text key={`ltick-${i}`} x={PAD.left - 6} y={getYLeft(v) + 3} textAnchor="end" fontSize={9} fill={varLeft.color} fontFamily="'Source Sans 3', sans-serif">
          {formatTick(v)}
        </text>
      ))}

      {/* Right Y-axis labels */}
      {rightTicks.map((v, i) => (
        <text key={`rtick-${i}`} x={W - PAD.right + 6} y={getYRight(v) + 3} textAnchor="start" fontSize={9} fill={varRight.color} fontFamily="'Source Sans 3', sans-serif">
          {formatTick(v)}
        </text>
      ))}

      {/* Axis lines */}
      <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + plotH} stroke={varLeft.color} strokeWidth={1.5} opacity={0.4} />
      <line x1={W - PAD.right} x2={W - PAD.right} y1={PAD.top} y2={PAD.top + plotH} stroke={varRight.color} strokeWidth={1.5} opacity={0.4} />

      {/* Left area + line */}
      {leftPoints.length > 1 && (
        <>
          <path
            d={makePath(leftPoints) + ` L${leftPoints[leftPoints.length - 1].x},${PAD.top + plotH} L${leftPoints[0].x},${PAD.top + plotH} Z`}
            fill={varLeft.color} opacity={0.06}
          />
          <path d={makePath(leftPoints)} fill="none" stroke={varLeft.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}

      {/* Right area + line */}
      {rightPoints.length > 1 && (
        <>
          <path
            d={makePath(rightPoints) + ` L${rightPoints[rightPoints.length - 1].x},${PAD.top + plotH} L${rightPoints[0].x},${PAD.top + plotH} Z`}
            fill={varRight.color} opacity={0.06}
          />
          <path d={makePath(rightPoints)} fill="none" stroke={varRight.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="6,3" />
        </>
      )}

      {/* Left dots */}
      {leftPoints.map(p => (
        <circle key={`ld-${p.yr}`} cx={p.x} cy={p.y} r={hovered === p.yr ? 5 : 3} fill="#fff" stroke={varLeft.color} strokeWidth={2} />
      ))}

      {/* Right dots */}
      {rightPoints.map(p => (
        <circle key={`rd-${p.yr}`} cx={p.x} cy={p.y} r={hovered === p.yr ? 5 : 3} fill="#fff" stroke={varRight.color} strokeWidth={2} />
      ))}

      {/* X-axis labels */}
      {years.map(y => (
        <text key={`x-${y}`} x={getX(y)} y={H - 8} textAnchor="middle" fontSize={9} fill={hovered === y ? "#3d3a35" : "#8a857a"} fontWeight={hovered === y ? 600 : 400} fontFamily="'Source Sans 3', sans-serif">
          {"'" + y.slice(2)}
        </text>
      ))}

      {/* Hover vertical line */}
      {hovered && hoveredX && (
        <line x1={hoveredX} x2={hoveredX} y1={PAD.top} y2={PAD.top + plotH} stroke="#3d3a35" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.4} />
      )}

      {/* Hover tooltip */}
      {hovered && (
        <g>
          <rect
            x={hoveredX + (hoveredX > W / 2 ? -145 : 10)}
            y={PAD.top + 5}
            width={135}
            height={52}
            rx={6}
            fill="#fff"
            stroke="#e0dbd3"
            strokeWidth={1}
            filter="drop-shadow(0 1px 3px rgba(0,0,0,0.1))"
          />
          <text
            x={hoveredX + (hoveredX > W / 2 ? -140 : 15)}
            y={PAD.top + 22}
            fontSize={11}
            fontWeight={600}
            fill="#3d3a35"
            fontFamily="'Source Sans 3', sans-serif"
          >
            {hovered}
          </text>
          <circle cx={hoveredX + (hoveredX > W / 2 ? -140 : 15) + 2} cy={PAD.top + 35} r={4} fill={varLeft.color} />
          <text
            x={hoveredX + (hoveredX > W / 2 ? -130 : 25)}
            y={PAD.top + 39}
            fontSize={10}
            fill={varLeft.color}
            fontFamily="'Source Sans 3', sans-serif"
          >
            {varLeft.label}: {formatVal(dataLeft?.[hovered], varLeft.unit)}
          </text>
          <circle cx={hoveredX + (hoveredX > W / 2 ? -140 : 15) + 2} cy={PAD.top + 49} r={4} fill={varRight.color} />
          <text
            x={hoveredX + (hoveredX > W / 2 ? -130 : 25)}
            y={PAD.top + 53}
            fontSize={10}
            fill={varRight.color}
            fontFamily="'Source Sans 3', sans-serif"
          >
            {varRight.label}: {formatVal(dataRight?.[hovered], varRight.unit)}
          </text>
        </g>
      )}

      {/* Legend */}
      <line x1={PAD.left} x2={PAD.left + 20} y1={12} y2={12} stroke={varLeft.color} strokeWidth={2} />
      <text x={PAD.left + 24} y={16} fontSize={10} fill={varLeft.color} fontFamily="'Source Sans 3', sans-serif" fontWeight={600}>
        {varLeft.label}{varLeft.unit ? ` (${varLeft.unit})` : ""}
      </text>
      <line x1={W / 2 + 10} x2={W / 2 + 30} y1={12} y2={12} stroke={varRight.color} strokeWidth={2} strokeDasharray="6,3" />
      <text x={W / 2 + 34} y={16} fontSize={10} fill={varRight.color} fontFamily="'Source Sans 3', sans-serif" fontWeight={600}>
        {varRight.label}{varRight.unit ? ` (${varRight.unit})` : ""}
      </text>
    </svg>
  );
}

/**
 * Graph Builder sidebar panel
 */
export default function GraphBuilder({ open, onClose, selected, chartInfo, migrationData, intervalMode, selectedPeriods }) {
  const [leftVar, setLeftVar] = useState("netMigration");
  const [rightVar, setRightVar] = useState("unemployment");

  // Build time series for migration variables
  const migrationTimeSeries = useMemo(() => {
    if (!migrationData || !selected) return {};
    const immigration = {};
    const emigration = {};
    const netMigration = {};

    for (const period of Object.keys(migrationData)) {
      const d = migrationData[period]?.[selected];
      if (d) {
        const ti = d.ti || 0;
        const to = d.to || 0;
        immigration[period] = ti;
        emigration[period] = to;
        netMigration[period] = ti - to;
      }
    }
    return { immigration, emigration, netMigration };
  }, [migrationData, selected]);

  // Get data series for a variable key
  const getDataForVar = (varKey) => {
    if (varKey === "immigration") return migrationTimeSeries.immigration || {};
    if (varKey === "emigration") return migrationTimeSeries.emigration || {};
    if (varKey === "netMigration") return migrationTimeSeries.netMigration || {};
    return chartInfo?.[varKey] || {};
  };

  // Expand selected periods into year endpoints (same logic as LineChart)
  const activeYears = useMemo(() => {
    const step = intervalMode === "10yr" ? 10 : 5;
    const yearSet = new Set();
    for (const p of selectedPeriods) {
      yearSet.add(p);
      yearSet.add(String(parseInt(p) + step));
    }
    return Array.from(yearSet).sort((a, b) => parseInt(a) - parseInt(b));
  }, [selectedPeriods, intervalMode]);

  // For migration variables, only use the period start years (not endpoints)
  const migrationYears = useMemo(() => {
    return Array.from(selectedPeriods).sort((a, b) => parseInt(a) - parseInt(b));
  }, [selectedPeriods]);

  // Pick the right set of years depending on variable type
  const getYearsForVar = (varKey) => {
    if (varKey === "immigration" || varKey === "emigration" || varKey === "netMigration") {
      return migrationYears;
    }
    return activeYears;
  };

  // Merge years from both variables (union), keeping order
  const chartYears = useMemo(() => {
    const leftYears = getYearsForVar(leftVar);
    const rightYears = getYearsForVar(rightVar);
    const merged = [...new Set([...leftYears, ...rightYears])];
    return merged.sort((a, b) => parseInt(a) - parseInt(b));
  }, [leftVar, rightVar, activeYears, migrationYears]);

  const leftVarInfo = VARIABLES.find(v => v.key === leftVar);
  const rightVarInfo = VARIABLES.find(v => v.key === rightVar);

  const selectStyle = {
    width: "100%",
    padding: "6px 10px",
    fontSize: 12,
    fontFamily: "'Source Sans 3', sans-serif",
    borderRadius: 6,
    border: "1px solid #d5d0c4",
    background: "#faf9f6",
    color: "#3d3a35",
    cursor: "pointer",
    outline: "none"
  };

  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        bottom: 0,
        width: 500,
        transform: open ? "translateX(0)" : "translateX(-100%)",
        background: "#fff",
        borderRight: "1px solid #e0dbd3",
        transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: open ? "4px 0 20px rgba(0,0,0,0.08)" : "none",
        zIndex: 10,
        color: "#3d3a35"
      }}
    >
      {/* Header */}
      <div style={{
        padding: "16px 20px 12px",
        borderBottom: "1px solid #e8e4dc",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start"
      }}>
        <div>
          <div style={{
            fontFamily: "'Source Serif 4', serif",
            fontSize: 18,
            fontWeight: 600,
            color: "#3d3a35"
          }}>
            Graph Builder
          </div>
          <div style={{ fontSize: 12, color: "#8a857a", marginTop: 2 }}>
            {selected ? getName(selected) : "Select a country on the map"}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: 18,
            color: "#8a857a",
            cursor: "pointer",
            padding: 4
          }}
        >
          ✕
        </button>
      </div>

      {selected ? (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {/* Variable selectors */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div>
              <div style={{
                fontSize: 10,
                color: leftVarInfo?.color || "#8a857a",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 6,
                fontWeight: 600
              }}>
                Left axis (solid)
              </div>
              <select value={leftVar} onChange={e => setLeftVar(e.target.value)} style={{ ...selectStyle, borderColor: leftVarInfo?.color || "#d5d0c4" }}>
                {VARIABLES.map(v => (
                  <option key={v.key} value={v.key}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{
                fontSize: 10,
                color: rightVarInfo?.color || "#8a857a",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 6,
                fontWeight: 600
              }}>
                Right axis (dashed)
              </div>
              <select value={rightVar} onChange={e => setRightVar(e.target.value)} style={{ ...selectStyle, borderColor: rightVarInfo?.color || "#d5d0c4" }}>
                {VARIABLES.map(v => (
                  <option key={v.key} value={v.key}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Chart */}
          <div style={{
            border: "1px solid #e8e4dc",
            borderRadius: 8,
            padding: "12px 8px 8px",
            background: "#faf9f6"
          }}>
            <DualAxisChart
              dataLeft={getDataForVar(leftVar)}
              dataRight={getDataForVar(rightVar)}
              varLeft={leftVarInfo}
              varRight={rightVarInfo}
              years={chartYears}
            />
          </div>

          {/* Hint */}
          <div style={{
            marginTop: 12,
            fontSize: 11,
            color: "#a9a49a",
            fontStyle: "italic",
            lineHeight: 1.5
          }}>
            Solid line uses the left axis · Dashed line uses the right axis.
            Hover over the chart to see exact values. Only selected periods are shown.
          </div>
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#a9a49a",
          fontSize: 14,
          fontStyle: "italic",
          padding: 40,
          textAlign: "center"
        }}>
          Click a country on the map to start building graphs
        </div>
      )}
    </div>
  );
}