import { formatNum, getName } from "../utils/formatters";

export default function MigrationList({ items, color, total }) {
  if (!items?.length) {
    return <div style={{ color: "#8a857a", fontSize: 13, fontStyle: "italic", padding: "8px 0" }}>No data</div>;
  }

  const peak = items[0][1] || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map(([code, val], i) => {
        const pct = total ? ((val / total) * 100).toFixed(1) : null;
        return (
          <div key={code} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ width: 20, textAlign: "right", color: "#8a857a", fontSize: 11 }}>{i + 1}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ color: "#3d3a35", fontSize: 13 }}>{getName(code)}</span>
                <span style={{ color: "#5c5850", fontSize: 12, fontWeight: 600 }}>
                  {formatNum(val)}
                  {pct && <span style={{ color: "#a9a49a", fontWeight: 400, marginLeft: 4, fontSize: 11 }}>{pct}%</span>}
                </span>
              </div>
              <div style={{ height: 3, background: "#e8e4dc", borderRadius: 2 }}>
                <div style={{ height: 3, background: color, borderRadius: 2, width: (val / peak * 100) + "%" }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}