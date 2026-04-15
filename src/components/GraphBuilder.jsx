import { useState, useMemo } from "react";
import { getName } from "../utils/formatters";

const VARS = [
  { key: "unemployment", label: "Unemployment", unit: "%", color: "#c2703e" },
  { key: "urbanization", label: "Urbanization", unit: "%", color: "#5a8a6a" },
  { key: "medianAge",    label: "Median Age",   unit: "yrs", color: "#6a7b8a" },
  { key: "immigration",  label: "Immigration",  unit: "", color: "#4878a8" },
  { key: "emigration",   label: "Emigration",   unit: "", color: "#c44e52" },
  { key: "netMigration", label: "Net Migration", unit: "", color: "#8a6a7b" },
];

// format a value for display in the tooltip
function fmtVal(v, unit) {
  if (v == null) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + "K";
  if (unit === "%" || unit === "yrs") return v.toFixed(1) + (unit === "%" ? "%" : " yrs");
  return v.toLocaleString();
}

function fmtTick(v) {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(0) + "K";
  if (abs < 10) return v.toFixed(1);
  return Math.round(v).toString();
}

function DualChart({ left, right, leftVar, rightVar, years }) {
  const [hover, setHover] = useState(null);
  const W = 460, H = 280;
  const pad = { t: 30, r: 55, b: 32, l: 55 };
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;

  if (!years.length) {
    return <div style={{ padding: 20, color: "#8a857a", fontSize: 13, fontStyle: "italic", textAlign: "center" }}>No data for selected periods</div>;
  }

  const nums = years.map(Number);
  const xLo = nums[0], xHi = nums[nums.length - 1], xSpan = xHi - xLo || 1;
  const xOf = yr => years.length === 1 ? pad.l + pw / 2 : pad.l + ((+yr - xLo) / xSpan) * pw;

  function makeScale(data) {
    const vals = years.map(y => data?.[y]).filter(v => v != null);
    if (!vals.length) return { yOf: () => pad.t + ph / 2, ticks: [] };
    const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
    const yLo = lo - span * 0.1, yHi = hi + span * 0.1;
    const yOf = v => pad.t + ph - ((v - yLo) / (yHi - yLo)) * ph;
    const ticks = Array.from({ length: 5 }, (_, i) => yLo + (i / 4) * (yHi - yLo));
    return { yOf, ticks };
  }

  const sL = makeScale(left);
  const sR = makeScale(right);

  const pts = (data, yOf) => years.filter(y => data?.[y] != null).map(y => ({ x: xOf(y), y: yOf(data[y]), v: data[y], yr: y }));
  const lPts = pts(left, sL.yOf);
  const rPts = pts(right, sR.yOf);

  const line = p => p.map((pt, i) => (i ? "L" : "M") + pt.x + "," + pt.y).join(" ");
  const area = p => line(p) + `L${p[p.length - 1].x},${pad.t + ph}L${p[0].x},${pad.t + ph}Z`;

  function onMove(e) {
    const mx = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = null, bestD = 30;
    for (const y of years) {
      const d = Math.abs(mx - xOf(y));
      if (d < bestD) { bestD = d; best = y; }
    }
    setHover(best);
  }

  const hx = hover ? xOf(hover) : 0;
  const tipLeft = hx > W / 2;

  return (
    <svg width={W} height={H} style={{ display: "block", cursor: "crosshair" }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      {/* grid */}
      {sL.ticks.map((v, i) => <line key={i} x1={pad.l} x2={W - pad.r} y1={sL.yOf(v)} y2={sL.yOf(v)} stroke="#e8e4dc" strokeWidth={0.5} />)}

      {/* y labels */}
      {sL.ticks.map((v, i) => <text key={"l" + i} x={pad.l - 6} y={sL.yOf(v) + 3} textAnchor="end" fontSize={9} fill={leftVar.color} fontFamily="'Source Sans 3'">{fmtTick(v)}</text>)}
      {sR.ticks.map((v, i) => <text key={"r" + i} x={W - pad.r + 6} y={sR.yOf(v) + 3} textAnchor="start" fontSize={9} fill={rightVar.color} fontFamily="'Source Sans 3'">{fmtTick(v)}</text>)}

      {/* axis lines */}
      <line x1={pad.l} x2={pad.l} y1={pad.t} y2={pad.t + ph} stroke={leftVar.color} strokeWidth={1.5} opacity={0.4} />
      <line x1={W - pad.r} x2={W - pad.r} y1={pad.t} y2={pad.t + ph} stroke={rightVar.color} strokeWidth={1.5} opacity={0.4} />

      {/* left series */}
      {lPts.length > 1 && <><path d={area(lPts)} fill={leftVar.color} opacity={0.06} /><path d={line(lPts)} fill="none" stroke={leftVar.color} strokeWidth={2} strokeLinejoin="round" /></>}
      {/* right series */}
      {rPts.length > 1 && <><path d={area(rPts)} fill={rightVar.color} opacity={0.06} /><path d={line(rPts)} fill="none" stroke={rightVar.color} strokeWidth={2} strokeLinejoin="round" strokeDasharray="6,3" /></>}

      {/* dots */}
      {lPts.map(p => <circle key={"ld" + p.yr} cx={p.x} cy={p.y} r={hover === p.yr ? 5 : 3} fill="#fff" stroke={leftVar.color} strokeWidth={2} />)}
      {rPts.map(p => <circle key={"rd" + p.yr} cx={p.x} cy={p.y} r={hover === p.yr ? 5 : 3} fill="#fff" stroke={rightVar.color} strokeWidth={2} />)}

      {/* x labels */}
      {years.map(y => <text key={y} x={xOf(y)} y={H - 8} textAnchor="middle" fontSize={9} fill={hover === y ? "#3d3a35" : "#8a857a"} fontWeight={hover === y ? 600 : 400} fontFamily="'Source Sans 3'">{"'" + y.slice(2)}</text>)}

      {/* hover crosshair + tooltip */}
      {hover && <>
        <line x1={hx} x2={hx} y1={pad.t} y2={pad.t + ph} stroke="#3d3a35" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.4} />
        <rect x={hx + (tipLeft ? -145 : 10)} y={pad.t + 5} width={135} height={52} rx={6} fill="#fff" stroke="#e0dbd3" />
        <text x={hx + (tipLeft ? -140 : 15)} y={pad.t + 22} fontSize={11} fontWeight={600} fill="#3d3a35" fontFamily="'Source Sans 3'">{hover}</text>
        <circle cx={hx + (tipLeft ? -138 : 17)} cy={pad.t + 35} r={4} fill={leftVar.color} />
        <text x={hx + (tipLeft ? -130 : 25)} y={pad.t + 39} fontSize={10} fill={leftVar.color} fontFamily="'Source Sans 3'">{leftVar.label}: {fmtVal(left?.[hover], leftVar.unit)}</text>
        <circle cx={hx + (tipLeft ? -138 : 17)} cy={pad.t + 49} r={4} fill={rightVar.color} />
        <text x={hx + (tipLeft ? -130 : 25)} y={pad.t + 53} fontSize={10} fill={rightVar.color} fontFamily="'Source Sans 3'">{rightVar.label}: {fmtVal(right?.[hover], rightVar.unit)}</text>
      </>}

      {/* legend */}
      <line x1={pad.l} x2={pad.l + 20} y1={12} y2={12} stroke={leftVar.color} strokeWidth={2} />
      <text x={pad.l + 24} y={16} fontSize={10} fill={leftVar.color} fontFamily="'Source Sans 3'" fontWeight={600}>{leftVar.label}{leftVar.unit ? ` (${leftVar.unit})` : ""}</text>
      <line x1={W / 2 + 10} x2={W / 2 + 30} y1={12} y2={12} stroke={rightVar.color} strokeWidth={2} strokeDasharray="6,3" />
      <text x={W / 2 + 34} y={16} fontSize={10} fill={rightVar.color} fontFamily="'Source Sans 3'" fontWeight={600}>{rightVar.label}{rightVar.unit ? ` (${rightVar.unit})` : ""}</text>
    </svg>
  );
}

export default function GraphBuilder({ open, onClose, selected, chartInfo, migrationData, intervalMode, selectedPeriods }) {
  const [lKey, setLKey] = useState("netMigration");
  const [rKey, setRKey] = useState("unemployment");

  // build migration time series from the raw per-period data
  const migSeries = useMemo(() => {
    if (!migrationData || !selected) return {};
    const imm = {}, emi = {}, net = {};
    for (const p of Object.keys(migrationData)) {
      const d = migrationData[p]?.[selected];
      if (!d) continue;
      imm[p] = d.ti || 0;
      emi[p] = d.to || 0;
      net[p] = (d.ti || 0) - (d.to || 0);
    }
    return { immigration: imm, emigration: emi, netMigration: net };
  }, [migrationData, selected]);

  function dataFor(key) {
    if (key === "immigration" || key === "emigration" || key === "netMigration") return migSeries[key] || {};
    return chartInfo?.[key] || {};
  }

  // compute which years to show based on selected periods
  const isMigVar = k => k === "immigration" || k === "emigration" || k === "netMigration";

  const chartYears = useMemo(() => {
    const step = intervalMode === "10yr" ? 10 : 5;
    const yrs = new Set();
    for (const p of selectedPeriods) {
      // migration vars only have the period start; demographic vars have start + end
      if (isMigVar(lKey) && isMigVar(rKey)) {
        yrs.add(p);
      } else if (!isMigVar(lKey) && !isMigVar(rKey)) {
        yrs.add(p); yrs.add(String(+p + step));
      } else {
        // mixed: include both to cover everything
        yrs.add(p); yrs.add(String(+p + step));
      }
    }
    return [...yrs].sort((a, b) => +a - +b);
  }, [selectedPeriods, intervalMode, lKey, rKey]);

  const lVar = VARS.find(v => v.key === lKey);
  const rVar = VARS.find(v => v.key === rKey);

  const sel = {
    width: "100%", padding: "6px 10px", fontSize: 12,
    fontFamily: "'Source Sans 3', sans-serif", borderRadius: 6,
    border: "1px solid #d5d0c4", background: "#faf9f6",
    color: "#3d3a35", cursor: "pointer", outline: "none"
  };

  return (
    <div onMouseDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}
      style={{
        position: "absolute", top: 0, left: 0, bottom: 0, width: 500,
        transform: open ? "translateX(0)" : "translateX(-100%)",
        background: "#fff", borderRight: "1px solid #e0dbd3",
        transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: open ? "4px 0 20px rgba(0,0,0,0.08)" : "none",
        zIndex: 10, color: "#3d3a35"
      }}>

      {/* header */}
      <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #e8e4dc", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 18, fontWeight: 600 }}>Graph Builder</div>
          <div style={{ fontSize: 12, color: "#8a857a", marginTop: 2 }}>{selected ? getName(selected) : "Select a country on the map"}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: "#8a857a", cursor: "pointer", padding: 4 }}>✕</button>
      </div>

      {selected ? (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 10, color: lVar?.color, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, fontWeight: 600 }}>Left axis (solid)</div>
              <select value={lKey} onChange={e => setLKey(e.target.value)} style={{ ...sel, borderColor: lVar?.color }}>
                {VARS.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: rVar?.color, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, fontWeight: 600 }}>Right axis (dashed)</div>
              <select value={rKey} onChange={e => setRKey(e.target.value)} style={{ ...sel, borderColor: rVar?.color }}>
                {VARS.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ border: "1px solid #e8e4dc", borderRadius: 8, padding: "12px 8px 8px", background: "#faf9f6" }}>
            <DualChart left={dataFor(lKey)} right={dataFor(rKey)} leftVar={lVar} rightVar={rVar} years={chartYears} />
          </div>

          <div style={{ marginTop: 12, fontSize: 11, color: "#a9a49a", fontStyle: "italic", lineHeight: 1.5 }}>
            Solid line → left axis · Dashed line → right axis. Hover for exact values. Only selected periods shown.
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#a9a49a", fontSize: 14, fontStyle: "italic", padding: 40, textAlign: "center" }}>
          Click a country on the map to start building graphs
        </div>
      )}
    </div>
  );
}