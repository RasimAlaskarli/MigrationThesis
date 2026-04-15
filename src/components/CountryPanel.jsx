import { useState, useMemo } from "react";
import { CONTINENTS, CODE_TO_CONTINENT } from "../data/constants";
import { formatNum, getName } from "../utils/formatters";
import LineChart from "./LineChart";
import MigrationList from "./MigrationList";
import CountrySearch from "./CountrySearch";

// stat card — shows latest value with a change arrow when multiple periods are selected
function StatCard({ label, value, change, unit, color, prefix }) {
  let display = "—";
  if (value != null) {
    display = (prefix || "") + formatNum(value) + (unit || "");
  }

  let changeEl = null;
  if (change != null && isFinite(change) && change !== 0) {
    const up = change > 0;
    const arrow = up ? "↑" : "↓";
    const pct = Math.abs(change).toFixed(0);
    changeEl = (
      <span style={{ fontSize: 12, fontWeight: 500, color: "#8a857a", marginLeft: 4, fontFamily: "'Source Sans 3', sans-serif" }}>
        {arrow}{pct}%
      </span>
    );
  }

  return (
    <div style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e8e4dc", background: "#faf9f6" }}>
      <div style={{ fontSize: 10, color: "#8a857a", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color, fontFamily: "'Source Serif 4', serif", marginTop: 2 }}>
        {display}{changeEl}
      </div>
    </div>
  );
}

function ConfidenceLegend({ hasConfidence }) {
  if (!hasConfidence) return null;

  return (
    <div style={{
      padding: "8px 12px",
      borderRadius: 6,
      marginBottom: 14,
      background: "#faf9f6",
      border: "1px solid #e8e4dc",
      fontSize: 11,
      lineHeight: 1.6,
      color: "#6b6660"
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4, color: "#8a857a" }}>
        Data quality flags
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span><span style={{ color: "#c44e52" }}>⚠</span> <b style={{ color: "#c44e52" }}>Unreliable</b> — discrepancy (&ge;5×) between IMS 2024 and closest other source</span>
        <span><span style={{ color: "#8a857a" }}>?</span> <b style={{ color: "#8a857a" }}>No reference</b> — corridor not present in WB 2011 or UN 2015 data</span>
        <span style={{ color: "#a9a49a", fontSize: 10, marginTop: 2 }}>Unmarked corridors are corroborated within 5× by at least one other source.</span>
      </div>
    </div>
  );
}

export default function CountryPanel({
  selected, panelOpen, onClose, periodLabel, sortedPeriods,
  selectedPeriods, mData, chartInfo, intervalMode, confidence, confidenceMeta
}) {
  const [tab, setTab] = useState("stats");
  const [direction, setDirection] = useState("in");
  const [continent, setContinent] = useState("All");

  // only show confidence indicators when at least one selected period has multiple sources
  const MULTI_SOURCE_5YR = new Set(["1990", "1995", "2000", "2005"]);
  const MULTI_SOURCE_10YR = new Set(["1990", "2000"]);
  const multiSourcePeriods = intervalMode === "10yr" ? MULTI_SOURCE_10YR : MULTI_SOURCE_5YR;
  const showConfidence = useMemo(() => {
    if (!confidence || !Object.keys(confidence).length) return false;
    return [...selectedPeriods].some(p => multiSourcePeriods.has(p));
  }, [confidence, selectedPeriods, intervalMode]);

  function metricInfo(metric) {
    if (!chartInfo?.[metric]) return { value: null, change: null };
    const step = intervalMode === "10yr" ? 10 : 5;
    const years = new Set();
    for (const p of selectedPeriods) {
      years.add(p);
      years.add(String(+p + step));
    }
    const sorted = [...years].sort((a, b) => +a - +b);
    const withData = sorted.filter(y => chartInfo[metric][y] != null);
    if (!withData.length) return { value: null, change: null };

    const latest = chartInfo[metric][withData[withData.length - 1]];
    const earliest = chartInfo[metric][withData[0]];

    let change = null;
    if (withData.length > 1 && earliest !== 0) {
      change = ((latest - earliest) / Math.abs(earliest)) * 100;
    }

    return { value: latest, change };
  }

  const net = mData ? (mData.ti || 0) - (mData.to || 0) : null;

  const topIn = useMemo(() => {
    if (!mData?.ai) return [];
    let entries = Object.entries(mData.ai);
    if (continent !== "All") entries = entries.filter(([c]) => CODE_TO_CONTINENT[c] === continent);
    return entries.sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [mData, continent]);

  const topOut = useMemo(() => {
    if (!mData?.ao) return [];
    let entries = Object.entries(mData.ao);
    if (continent !== "All") entries = entries.filter(([c]) => CODE_TO_CONTINENT[c] === continent);
    return entries.sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [mData, continent]);

  const contTotals = useMemo(() => {
    if (!mData) return {};
    const out = {};
    for (const c of CONTINENTS.filter(c => c !== "All")) {
      let i = 0, o = 0;
      for (const [code, val] of Object.entries(mData.ai || {})) if (CODE_TO_CONTINENT[code] === c) i += val;
      for (const [code, val] of Object.entries(mData.ao || {})) if (CODE_TO_CONTINENT[code] === c) o += val;
      if (i || o) out[c] = { in: i, out: o };
    }
    return out;
  }, [mData]);

  const stopProp = { onMouseDown: e => e.stopPropagation(), onWheel: e => e.stopPropagation(), onTouchStart: e => e.stopPropagation() };

  return (
    <div {...stopProp} style={{
      position: "absolute", top: 0, right: 0, bottom: 0, width: 430,
      transform: panelOpen ? "translateX(0)" : "translateX(100%)",
      background: "#fff", borderLeft: "1px solid #e0dbd3",
      transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
      overflow: "hidden", display: "flex", flexDirection: "column",
      boxShadow: panelOpen ? "-4px 0 20px rgba(0,0,0,0.08)" : "none",
      zIndex: 10, color: "#3d3a35"
    }}>
      {selected && (<>
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #e8e4dc", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 20, fontWeight: 600 }}>{getName(selected)}</div>
            <div style={{ fontSize: 12, color: "#8a857a", marginTop: 2 }}>
              {periodLabel} · {sortedPeriods.length > 1 ? sortedPeriods.length + " periods combined" : (intervalMode === "10yr" ? "10" : "5") + "-year period"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: "#8a857a", cursor: "pointer", padding: 4 }}>✕</button>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid #e8e4dc" }}>
          {["stats", "migration"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "10px 0", fontSize: 13,
              fontWeight: tab === t ? 600 : 400, color: tab === t ? "#3d3a35" : "#8a857a",
              background: "none", border: "none",
              borderBottom: tab === t ? "2px solid #3d3a35" : "2px solid transparent",
              cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif",
              textTransform: "capitalize"
            }}>{t === "stats" ? "Statistics" : "Migration"}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

          {tab === "stats" && (<>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              <StatCard label="Unemployment" value={metricInfo("unemployment").value} change={metricInfo("unemployment").change} unit="%" color="#c2703e" />
              <StatCard label="Urbanization" value={metricInfo("urbanization").value} change={metricInfo("urbanization").change} unit="%" color="#5a8a6a" />
              <StatCard label="Median Age" value={metricInfo("medianAge").value} change={metricInfo("medianAge").change} unit="" color="#6a7b8a" />
              <StatCard label="Net Migration" value={net} color="#8a6a7b" prefix={net != null && net >= 0 ? "+" : ""} />
            </div>

            <LineChart data={chartInfo?.unemployment} label="Unemployment" unit="%" color="#c2703e" selectedPeriods={selectedPeriods} intervalMode={intervalMode} />
            <LineChart data={chartInfo?.urbanization} label="Urbanization" unit="%" color="#5a8a6a" selectedPeriods={selectedPeriods} intervalMode={intervalMode} />
            <LineChart data={chartInfo?.medianAge} label="Median Age" unit="years" color="#6a7b8a" selectedPeriods={selectedPeriods} intervalMode={intervalMode} />
          </>)}

          {tab === "migration" && (<>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              <StatCard label="Arrived" value={mData?.ti} color="#5a8a6a" />
              <StatCard label="Departed" value={mData?.to} color="#c2703e" />
              <StatCard label="Net" value={net} color="#6a7b8a" prefix={net != null && net >= 0 ? "+" : ""} />
            </div>

            <ConfidenceLegend hasConfidence={showConfidence} />

            <CountrySearch selected={selected} mData={mData} confidence={showConfidence ? confidence : null} confidenceMeta={confidenceMeta} />

            <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
              {[["in", "Immigration"], ["out", "Emigration"]].map(([k, lbl]) => (
                <button key={k} onClick={() => setDirection(k)} style={{
                  flex: 1, padding: "7px 0", fontSize: 12,
                  fontWeight: direction === k ? 600 : 400,
                  background: direction === k ? "#3d3a35" : "#f5f2ed",
                  color: direction === k ? "#fff" : "#8a857a",
                  border: "1px solid #e0dbd3", borderRadius: 6,
                  cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif"
                }}>{lbl}</button>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#8a857a", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Filter by continent</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {CONTINENTS.map(c => (
                  <button key={c} onClick={() => setContinent(c)} style={{
                    padding: "4px 10px", fontSize: 11,
                    fontWeight: continent === c ? 600 : 400,
                    background: continent === c ? "#3d3a35" : "#f5f2ed",
                    color: continent === c ? "#fff" : "#8a857a",
                    border: "1px solid #e0dbd3", borderRadius: 12,
                    cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif", transition: "all 0.15s"
                  }}>
                    {c}{c !== "All" && contTotals[c] ? ` (${formatNum(direction === "in" ? contTotals[c].in : contTotals[c].out)})` : ""}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ fontSize: 12, color: "#8a857a", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Top 10 {direction === "in" ? "sources" : "destinations"}{continent !== "All" ? ` — ${continent}` : ""}
            </div>
            <MigrationList
              items={direction === "in" ? topIn : topOut}
              color={direction === "in" ? "#5a8a6a" : "#c2703e"}
              total={direction === "in" ? mData?.ti : mData?.to}
              confidence={showConfidence ? confidence : null}
              confidenceMeta={confidenceMeta}
              direction={direction}
              selected={selected}
            />
          </>)}
        </div>

        <div style={{ padding: "8px 20px", borderTop: "1px solid #e8e4dc", fontSize: 10, color: "#a9a49a", fontStyle: "italic" }}>
          Migration: Abel &amp; Sander (2014) · Demographics: World Bank, UN WPP
          {mData?.usesHistoricalData && (
            <div style={{ marginTop: 4, color: "#c2703e" }}>
              ⚠ Pre-2010 data includes {selected === "SRB" ? "Montenegro" : selected === "SDN" ? "South Sudan" : "predecessor state"}
            </div>
          )}
        </div>
      </>)}
    </div>
  );
}