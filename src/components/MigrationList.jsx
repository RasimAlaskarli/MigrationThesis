import { formatNum, getName } from '../utils/formatters';

/**
 * Ranked list of migration sources or destinations
 */
export default function MigrationList({ items, color }) {
  if (!items || items.length === 0) {
    return (
      <div style={{ color: "#8a857a", fontSize: 13, fontStyle: "italic", padding: "8px 0" }}>
        No data
      </div>
    );
  }

  const maxVal = items[0]?.[1] || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map(([code, val], i) => (
        <div key={code} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <span style={{
            width: 20,
            textAlign: "right",
            color: "#8a857a",
            fontSize: 11,
            fontFamily: "'Source Sans 3', sans-serif"
          }}>
            {i + 1}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{
                color: "#3d3a35",
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: 13
              }}>
                {getName(code)}
              </span>
              <span style={{
                color: "#5c5850",
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: 12,
                fontWeight: 600
              }}>
                {formatNum(val)}
              </span>
            </div>
            <div style={{ height: 3, background: "#e8e4dc", borderRadius: 2 }}>
              <div style={{
                height: 3,
                background: color,
                borderRadius: 2,
                width: `${(val / maxVal) * 100}%`
              }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
