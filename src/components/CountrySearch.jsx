import { useState, useMemo } from "react";
import { CODE_TO_NAME } from "../data/constants";
import { formatNum, getName } from "../utils/formatters";

const CONF_INFO = {
  unreliable: { color: "#c44e52", label: "Unreliable — discrepancy ≥5× between sources" },
  "no-reference": { color: "#8a857a", label: "No reference — not present in other sources" },
};

function buildConfidenceTitle(confidenceMeta, origin, destination, fallbackLabel) {
  const key = `${origin}-${destination}`;
  const evidence = confidenceMeta?.evidence?.[key];
  if (!evidence) return fallbackLabel;

  if (evidence.method === "source_ratio") {
    return `${fallbackLabel} — ${evidence.sources[0]} vs ${evidence.sources[1]} differs by ${evidence.ratio}x in ${evidence.year}`;
  }

  return fallbackLabel;
}

export default function CountrySearch({ selected, mData, confidence, confidenceMeta }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(null);

  const codes = useMemo(() =>
    Object.keys(CODE_TO_NAME)
      .filter(c => c !== selected && c.length === 3)
      .sort((a, b) => getName(a).localeCompare(getName(b))),
    [selected]
  );

  const matches = useMemo(() => {
    if (!query) return codes.slice(0, 20);
    const q = query.toLowerCase();
    return codes.filter(c => getName(c).toLowerCase().includes(q)).slice(0, 20);
  }, [query, codes]);

  const flow = useMemo(() => {
    if (!mData || !picked) return null;
    return { from: mData.ai?.[picked] || 0, to: mData.ao?.[picked] || 0 };
  }, [mData, picked]);

  function getConf(origin, destination) {
    if (!confidence) return null;
    return confidence[`${origin}-${destination}`] || null;
  }

  function ConfBadge({ level, origin, destination }) {
    const info = CONF_INFO[level];
    if (!info) return null;
    const title = buildConfidenceTitle(confidenceMeta, origin, destination, info.label);

    return (
      <div
        title={title}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          fontSize: 9,
          color: info.color,
          marginTop: 4,
          fontFamily: "'Source Sans 3', sans-serif",
          cursor: "help"
        }}
      >
        {level === "no-reference" ? "?" : "⚠"} {info.label}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: "#8a857a", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.03em" }}>Bilateral Flow</div>

      <input
        type="text" value={query}
        onChange={e => { setQuery(e.target.value); setPicked(null); }}
        placeholder="Search country..."
        style={{
          width: "100%", padding: "8px 12px", borderRadius: 6,
          border: "1px solid #d5d0c4", fontSize: 13,
          fontFamily: "'Source Sans 3', sans-serif", background: "#faf9f6",
          outline: "none", boxSizing: "border-box", color: "#3d3a35"
        }}
      />

      {query && !picked && (
        <div style={{ border: "1px solid #e0dbd3", borderRadius: 6, maxHeight: 160, overflowY: "auto", marginTop: 4, background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
          {matches.map(c => (
            <div key={c}
              onClick={() => { setPicked(c); setQuery(getName(c)); }}
              style={{ padding: "6px 12px", fontSize: 13, cursor: "pointer", borderBottom: "1px solid #f0ece6", color: "#3d3a35" }}
              onMouseEnter={e => e.target.style.background = "#f5f2ed"}
              onMouseLeave={e => e.target.style.background = "#fff"}
            >{getName(c)}</div>
          ))}
        </div>
      )}

      {flow && picked && (
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #e8e4dc", background: "#faf9f6" }}>
            <div style={{ fontSize: 10, color: "#8a857a", textTransform: "uppercase" }}>{getName(picked)} → {getName(selected)}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#5a8a6a", fontFamily: "'Source Serif 4', serif" }}>
              {formatNum(flow.from)}
              {mData?.ti > 0 && <span style={{ fontSize: 11, fontWeight: 400, color: "#a9a49a", marginLeft: 4 }}>{((flow.from / mData.ti) * 100).toFixed(1)}%</span>}
            </div>
            <ConfBadge level={getConf(picked, selected)} origin={picked} destination={selected} />
          </div>
          <div style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #e8e4dc", background: "#faf9f6" }}>
            <div style={{ fontSize: 10, color: "#8a857a", textTransform: "uppercase" }}>{getName(selected)} → {getName(picked)}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#c2703e", fontFamily: "'Source Serif 4', serif" }}>
              {formatNum(flow.to)}
              {mData?.to > 0 && <span style={{ fontSize: 11, fontWeight: 400, color: "#a9a49a", marginLeft: 4 }}>{((flow.to / mData.to) * 100).toFixed(1)}%</span>}
            </div>
            <ConfBadge level={getConf(selected, picked)} origin={selected} destination={picked} />
          </div>
        </div>
      )}
    </div>
  );
}