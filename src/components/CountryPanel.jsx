import { useState, useMemo } from 'react';
import { CONTINENTS, CODE_TO_CONTINENT } from '../data/constants';
import { formatNum, getName } from '../utils/formatters';
import LineChart from './LineChart';
import MigrationList from './MigrationList';
import CountrySearch from './CountrySearch';

/**
 * Side panel showing country details, statistics, and migration data
 */
export default function CountryPanel({
  selected,
  panelOpen,
  onClose,
  periodLabel,
  sortedPeriods,
  selectedPeriods,
  mData,
  chartInfo,
  intervalMode
}) {
  const [infoTab, setInfoTab] = useState("stats");
  const [migDirection, setMigDirection] = useState("in");
  const [continentFilter, setContinentFilter] = useState("All");

  // Top 10 migration lists with continent filter
  const topIncoming = useMemo(() => {
    if (!mData?.ai) return [];
    let entries = Object.entries(mData.ai);
    if (continentFilter !== "All") {
      entries = entries.filter(([code]) => CODE_TO_CONTINENT[code] === continentFilter);
    }
    return entries.sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [mData, continentFilter]);

  const topOutgoing = useMemo(() => {
    if (!mData?.ao) return [];
    let entries = Object.entries(mData.ao);
    if (continentFilter !== "All") {
      entries = entries.filter(([code]) => CODE_TO_CONTINENT[code] === continentFilter);
    }
    return entries.sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [mData, continentFilter]);

  // Continent totals for summary
  const continentTotals = useMemo(() => {
    if (!mData) return null;
    const totals = {};
    for (const cont of CONTINENTS.filter(c => c !== "All")) {
      let inVal = 0, outVal = 0;
      if (mData.ai) {
        for (const [code, val] of Object.entries(mData.ai)) {
          if (CODE_TO_CONTINENT[code] === cont) inVal += val;
        }
      }
      if (mData.ao) {
        for (const [code, val] of Object.entries(mData.ao)) {
          if (CODE_TO_CONTINENT[code] === cont) outVal += val;
        }
      }
      if (inVal > 0 || outVal > 0) {
        totals[cont] = { in: inVal, out: outVal };
      }
    }
    return totals;
  }, [mData]);

  // Calculate average metric across selected period endpoints
  const avgMetric = (metric) => {
    if (!chartInfo?.[metric]) return null;
    const step = intervalMode === "10yr" ? 10 : 5;
    const yearSet = new Set();
    for (const p of selectedPeriods) {
      yearSet.add(p);
      yearSet.add(String(parseInt(p) + step));
    }
    const vals = Array.from(yearSet).map(y => chartInfo[metric][y]).filter(v => v != null);
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : null;
  };

  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: 430,
        transform: panelOpen ? "translateX(0)" : "translateX(100%)",
        background: "#fff",
        borderLeft: "1px solid #e0dbd3",
        transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: panelOpen ? "-4px 0 20px rgba(0,0,0,0.08)" : "none",
        zIndex: 10,
        color: "#3d3a35"
      }}
    >
      {selected && (
        <>
          {/* Panel Header */}
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
                fontSize: 20,
                fontWeight: 600,
                color: "#3d3a35"
              }}>
                {getName(selected)}
              </div>
              <div style={{ fontSize: 12, color: "#8a857a", marginTop: 2 }}>
                {periodLabel} · {sortedPeriods.length > 1 ? `${sortedPeriods.length} periods combined` : `${intervalMode === "10yr" ? "10" : "5"}-year period`}
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

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #e8e4dc" }}>
            {[{ key: "stats", label: "Statistics" }, { key: "migration", label: "Migration" }].map(t => (
              <button
                key={t.key}
                onClick={() => setInfoTab(t.key)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  fontSize: 13,
                  fontWeight: infoTab === t.key ? 600 : 400,
                  color: infoTab === t.key ? "#3d3a35" : "#8a857a",
                  background: "none",
                  border: "none",
                  borderBottom: infoTab === t.key ? "2px solid #3d3a35" : "2px solid transparent",
                  cursor: "pointer",
                  fontFamily: "'Source Sans 3', sans-serif"
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            {infoTab === "stats" && (
              <div>
                {/* Snapshot cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                  {[
                    { label: "Unemployment", val: avgMetric("unemployment"), unit: "%", color: "#c2703e" },
                    { label: "Urbanization", val: avgMetric("urbanization"), unit: "%", color: "#5a8a6a" },
                    { label: "Median Age", val: avgMetric("medianAge"), unit: "yrs", color: "#6a7b8a" },
                    { label: "Net Migration", val: mData ? (mData.ti || 0) - (mData.to || 0) : null, unit: "", color: "#8a6a7b" },
                  ].map(c => (
                    <div key={c.label} style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #e8e4dc",
                      background: "#faf9f6"
                    }}>
                      <div style={{
                        fontSize: 10,
                        color: "#8a857a",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em"
                      }}>
                        {c.label}
                      </div>
                      <div style={{
                        fontSize: 20,
                        fontWeight: 600,
                        color: c.color,
                        fontFamily: "'Source Serif 4', serif",
                        marginTop: 2
                      }}>
                        {c.val != null
                          ? (c.label === "Net Migration"
                            ? (c.val >= 0 ? "+" : "") + formatNum(c.val)
                            : c.val + (c.unit ? c.unit : ""))
                          : "—"}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Line charts */}
                <LineChart
                  data={chartInfo?.unemployment}
                  label="Unemployment"
                  unit="%"
                  color="#c2703e"
                  selectedPeriods={selectedPeriods}
                  intervalMode={intervalMode}
                />
                <LineChart
                  data={chartInfo?.urbanization}
                  label="Urbanization"
                  unit="%"
                  color="#5a8a6a"
                  selectedPeriods={selectedPeriods}
                  intervalMode={intervalMode}
                />
                <LineChart
                  data={chartInfo?.medianAge}
                  label="Median Age"
                  unit="years"
                  color="#6a7b8a"
                  selectedPeriods={selectedPeriods}
                  intervalMode={intervalMode}
                />
              </div>
            )}

            {infoTab === "migration" && (
              <div>
                {/* Migration summary */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
                  {[
                    { label: "Arrived", val: mData?.ti, color: "#5a8a6a" },
                    { label: "Departed", val: mData?.to, color: "#c2703e" },
                    { label: "Net", val: mData ? (mData.ti || 0) - (mData.to || 0) : null, color: "#6a7b8a" },
                  ].map(c => (
                    <div key={c.label} style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #e8e4dc",
                      background: "#faf9f6",
                      textAlign: "center"
                    }}>
                      <div style={{
                        fontSize: 10,
                        color: "#8a857a",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em"
                      }}>
                        {c.label}
                      </div>
                      <div style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: c.color,
                        fontFamily: "'Source Serif 4', serif",
                        marginTop: 2
                      }}>
                        {c.val != null
                          ? (c.label === "Net" ? (c.val >= 0 ? "+" : "") + formatNum(c.val) : formatNum(c.val))
                          : "—"}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Country picker for bilateral flow */}
                <CountrySearch selected={selected} mData={mData} />

                {/* Direction toggle */}
                <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                  {[{ key: "in", label: "Immigration" }, { key: "out", label: "Emigration" }].map(d => (
                    <button
                      key={d.key}
                      onClick={() => setMigDirection(d.key)}
                      style={{
                        flex: 1,
                        padding: "7px 0",
                        fontSize: 12,
                        fontWeight: migDirection === d.key ? 600 : 400,
                        background: migDirection === d.key ? "#3d3a35" : "#f5f2ed",
                        color: migDirection === d.key ? "#fff" : "#8a857a",
                        border: "1px solid #e0dbd3",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontFamily: "'Source Sans 3', sans-serif"
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                {/* Continent filter */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 10,
                    color: "#8a857a",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 6
                  }}>
                    Filter by continent
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {CONTINENTS.map(c => (
                      <button
                        key={c}
                        onClick={() => setContinentFilter(c)}
                        style={{
                          padding: "4px 10px",
                          fontSize: 11,
                          fontWeight: continentFilter === c ? 600 : 400,
                          background: continentFilter === c ? "#3d3a35" : "#f5f2ed",
                          color: continentFilter === c ? "#fff" : "#8a857a",
                          border: "1px solid #e0dbd3",
                          borderRadius: 12,
                          cursor: "pointer",
                          fontFamily: "'Source Sans 3', sans-serif",
                          transition: "all 0.15s"
                        }}
                      >
                        {c}
                        {c !== "All" && continentTotals?.[c]
                          ? ` (${formatNum(migDirection === "in" ? continentTotals[c].in : continentTotals[c].out)})`
                          : ""}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Top 10 list */}
                <div style={{
                  fontSize: 12,
                  color: "#8a857a",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em"
                }}>
                  Top 10 {migDirection === "in" ? "Sources" : "Destinations"}
                  {continentFilter !== "All" ? ` — ${continentFilter}` : ""}
                </div>
                <MigrationList
                  items={migDirection === "in" ? topIncoming : topOutgoing}
                  color={migDirection === "in" ? "#5a8a6a" : "#c2703e"}
                />
              </div>
            )}
          </div>

          {/* Data source note */}
          <div style={{
            padding: "8px 20px",
            borderTop: "1px solid #e8e4dc",
            fontSize: 10,
            color: "#a9a49a",
            fontStyle: "italic"
          }}>
            Migration: Abel & Sander (2014) · Demographics: World Bank, UN WPP
            {mData?.usesHistoricalData && (
              <div style={{ marginTop: 4, color: "#c2703e" }}>
                ⚠ Pre-2010 migration data includes {selected === "SRB" ? "Montenegro" : selected === "SDN" ? "South Sudan" : "predecessor state"}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}