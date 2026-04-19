import { formatNum, getName } from "../utils/formatters";

const CONFIDENCE_STYLES = {
  high_confidence: null, // no badge — clean display
  moderate_confidence: {
    color: "#e0a020",
    label: "Moderate confidence — some disagreement among retained estimates",
    icon: "●"
  },
  low_confidence: {
    color: "#c44e52",
    label: "Low confidence — broad disagreement among retained estimates",
    icon: "●"
  },
  insufficient_evidence: {
    color: "#8a857a",
    label: "Insufficient evidence — too few retained values above threshold",
    icon: "?"
  },
};

function buildConfidenceKey(direction, selected, code) {
  return direction === "in"
    ? `${code}-${selected}`
    : `${selected}-${code}`;
}

function getWorstConfidence(levels) {
  if (!levels.length) return null;

  const rank = {
    high_confidence: 1,
    moderate_confidence: 2,
    low_confidence: 3,
    insufficient_evidence: 4,
  };

  return [...levels].sort((a, b) => (rank[b] || 0) - (rank[a] || 0))[0];
}

function buildConfidenceTitle(confidence, key, fallbackLabel, selectedPeriods) {
  const periods = selectedPeriods ? [...selectedPeriods] : [];
  const years = periods.filter(p => confidence?.[p]?.[key]);

  if (!years.length) return fallbackLabel;
  if (years.length === 1) return `${fallbackLabel} — ${years[0]}`;

  return `${fallbackLabel} — ${years.join(", ")}`;
}

export default function MigrationList({
  items,
  color,
  total,
  confidence,
  direction,
  selected,
  selectedPeriods
}) {
  if (!items?.length) {
    return <div style={{ color: "#8a857a", fontSize: 13, fontStyle: "italic", padding: "8px 0" }}>No data</div>;
  }

  const peak = items[0][1] || 1;

  function getConfidence(code) {
    if (!confidence) return null;
    const key = buildConfidenceKey(direction, selected, code);

    const levels = [];
    for (const period of selectedPeriods || []) {
      const level = confidence?.[period]?.[key];
      if (level) levels.push(level);
    }

    return getWorstConfidence(levels);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map(([code, val], i) => {
        const pct = total ? ((val / total) * 100).toFixed(1) : null;
        const key = buildConfidenceKey(direction, selected, code);
        const conf = getConfidence(code);
        const style = conf ? CONFIDENCE_STYLES[conf] : null;
        const title = style ? buildConfidenceTitle(confidence, key, style.label, selectedPeriods) : "";

        return (
          <div key={code} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ width: 20, textAlign: "right", color: "#8a857a", fontSize: 11 }}>{i + 1}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                <span style={{ color: "#3d3a35", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                  {getName(code)}
                  {style && (
                    <span
                      title={title}
                      style={{
                        fontSize: 11,
                        color: style.color,
                        cursor: "help",
                        lineHeight: 1
                      }}
                    >
                      {style.icon}
                    </span>
                  )}
                </span>
                <span style={{ color: "#5c5850", fontSize: 12, fontWeight: 600 }}>
                  {formatNum(val)}
                  {pct && <span style={{ color: "#a9a49a", fontWeight: 400, marginLeft: 4, fontSize: 11 }}>{pct}%</span>}
                </span>
              </div>
              <div style={{ height: 3, background: "#e8e4dc", borderRadius: 2 }}>
                <div style={{
                  height: 3,
                  background: color,
                  borderRadius: 2,
                  width: `${(val / peak) * 100}%`,
                  opacity: 1
                }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}