import { formatNum, getName } from "../utils/formatters";

const CONFIDENCE_STYLES = {
  unreliable: {
    color: "#c44e52",
    label: "Unreliable — discrepancy (≥5×) between data sources",
    icon: "⚠"
  },
  "no-reference": {
    color: "#8a857a",
    label: "No reference — not present in other data sources",
    icon: "?"
  },
};

function buildConfidenceKey(direction, selected, code) {
  return direction === "in"
    ? `${code}-${selected}`
    : `${selected}-${code}`;
}

function buildConfidenceTitle(confidenceMeta, key, fallbackLabel) {
  const evidence = confidenceMeta?.evidence?.[key];
  if (!evidence) return fallbackLabel;

  if (evidence.method === "source_ratio") {
    return `${fallbackLabel} — ${evidence.sources[0]} vs ${evidence.sources[1]} differs by ${evidence.ratio}x in ${evidence.year}`;
  }

  return fallbackLabel;
}

export default function MigrationList({ items, color, total, confidence, confidenceMeta, direction, selected }) {
  if (!items?.length) {
    return <div style={{ color: "#8a857a", fontSize: 13, fontStyle: "italic", padding: "8px 0" }}>No data</div>;
  }

  const peak = items[0][1] || 1;

  function getConfidence(code) {
    if (!confidence) return null;
    const key = buildConfidenceKey(direction, selected, code);
    return confidence[key] || null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map(([code, val], i) => {
        const pct = total ? ((val / total) * 100).toFixed(1) : null;
        const key = buildConfidenceKey(direction, selected, code);
        const conf = getConfidence(code);
        const style = conf ? CONFIDENCE_STYLES[conf] : null;
        const title = style ? buildConfidenceTitle(confidenceMeta, key, style.label) : "";

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
                  width: (val / peak * 100) + "%",
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