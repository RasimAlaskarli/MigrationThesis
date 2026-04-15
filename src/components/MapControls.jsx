// zoom, period selector, choropleth dropdown, hover tooltip, click hint

export function ZoomControls({ onZoomIn, onZoomOut, onReset }) {
  const btn = {
    width: 32, height: 32, border: "1px solid #c4bfb4", borderRadius: 6,
    background: "#fff", color: "#3d3a35", fontSize: 16, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
  };
  return (
    <div style={{ position: "absolute", bottom: 20, left: 20, display: "flex", flexDirection: "column", gap: 4 }}>
      <button onClick={onZoomIn} style={btn}>+</button>
      <button onClick={onZoomOut} style={btn}>−</button>
      <button onClick={onReset} style={btn}>⟲</button>
    </div>
  );
}

export function PeriodSelector({
  selectedPeriods,
  onTogglePeriod,
  onToggleAll,
  intervalMode,
  onIntervalChange,
  periods,
  stockSource,
  onStockSourceChange,
  sourceLabels,
  availableSources
}) {
  const allOn = selectedPeriods.size === periods.length;

  const toggle = active => ({
    padding: "4px 8px", fontSize: 10, fontWeight: 600,
    background: active ? "#3d3a35" : "#f0ece6",
    color: active ? "#fff" : "#8a857a",
    border: "none", borderRadius: 4, cursor: "pointer",
    fontFamily: "'Source Sans 3', sans-serif", transition: "all 0.15s"
  });

  const sourceButtonText = {
    wb: "WB 2011",
    un: "UN 2015",
    ims: "IMS 2024"
  };

  const sourceDescriptions = {
    wb: sourceLabels?.wb || "WB 2011 stock tables",
    un: sourceLabels?.un || "UN 2015 stock tables",
    ims: sourceLabels?.ims || "IMS 2024"
  };

  return (
    <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      {availableSources?.length > 0 && (
        <div style={{ display: "flex", gap: 2, background: "#fff", padding: 3, borderRadius: 6, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", border: "1px solid #e0dbd3", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
          <span style={{ fontSize: 9, color: "#8a857a", padding: "3px 6px", alignSelf: "center" }}>Source:</span>
          {availableSources.map(src => (
            <button
              key={src}
              title={sourceDescriptions[src]}
              onClick={() => onStockSourceChange(src)}
              style={toggle(stockSource === src)}
            >
              {sourceButtonText[src]}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 2, background: "#fff", padding: 4, borderRadius: 8, boxShadow: "0 1px 6px rgba(0,0,0,0.1)", border: "1px solid #e0dbd3", alignItems: "center" }}>
        <button onClick={onToggleAll} style={{
          padding: "5px 8px", fontSize: 10, fontWeight: 600,
          background: allOn ? "#3d3a35" : "#f0ece6",
          color: allOn ? "#fff" : "#8a857a",
          border: "none", borderRadius: 5, cursor: "pointer",
          fontFamily: "'Source Sans 3', sans-serif",
          textTransform: "uppercase", letterSpacing: "0.03em", marginRight: 4
        }}>{allOn ? "Clear" : "All"}</button>

        <div style={{ width: 1, height: 16, background: "#e0dbd3", marginRight: 2 }} />

        {periods.map(p => (
          <button key={p} onClick={() => onTogglePeriod(p)} style={{
            padding: "5px 8px", fontSize: 11,
            fontWeight: selectedPeriods.has(p) ? 600 : 400,
            background: selectedPeriods.has(p) ? "#3d3a35" : "transparent",
            color: selectedPeriods.has(p) ? "#fff" : "#8a857a",
            border: "none", borderRadius: 5, cursor: "pointer",
            fontFamily: "'Source Sans 3', sans-serif", transition: "all 0.15s"
          }}>{p}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 2, background: "#fff", padding: 3, borderRadius: 6, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", border: "1px solid #e0dbd3" }}>
        <button onClick={() => onIntervalChange("5yr")} style={toggle(intervalMode === "5yr")}>5-year</button>
        <button onClick={() => onIntervalChange("10yr")} style={toggle(intervalMode === "10yr")}>10-year</button>
      </div>
    </div>
  );
}

export function ChoroplethSelector({ value, onChange, panelOpen }) {
  const stops = {
    netMigration:     ["#c44e52", "#e8a8a9", "#f5f2ed", "#8fb3cf", "#4878a8"],
    totalImmigration: ["#eef4ef", "#6aad7a", "#2d6a3f"],
    totalEmigration:  ["#fef0e4", "#daa070", "#c2703e"],
    unemployment:     ["#fef0e4", "#daa070", "#c2703e"],
    urbanization:     ["#eef4ef", "#6aad7a", "#2d6a3f"],
    medianAge:        ["#eef1f4", "#7a9ab0", "#3d5a72"]
  };
  const labels = {
    netMigration: ["Emigration", "Immigration"],
    totalImmigration: ["Low", "High"], totalEmigration: ["Low", "High"],
    unemployment: ["Low", "High"], urbanization: ["Low", "High"],
    medianAge: ["Young", "Old"]
  };

  return (
    <div style={{
      position: "absolute", top: 16, right: panelOpen ? 450 : 20,
      transition: "right 0.35s cubic-bezier(0.4,0,0.2,1)",
      background: "#fff", padding: "8px 12px", borderRadius: 8,
      boxShadow: "0 1px 6px rgba(0,0,0,0.1)", border: "1px solid #e0dbd3"
    }}>
      <div style={{ fontSize: 10, color: "#8a857a", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Map shading</div>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        fontSize: 12, fontFamily: "'Source Sans 3', sans-serif", padding: "4px 8px",
        borderRadius: 4, border: "1px solid #d5d0c4", background: "#faf9f6",
        color: "#3d3a35", cursor: "pointer", outline: "none"
      }}>
        <option value="none">None</option>
        <option value="netMigration">Net migration</option>
        <option value="totalImmigration">Total immigration</option>
        <option value="totalEmigration">Total emigration</option>
        <option value="unemployment">Unemployment</option>
        <option value="urbanization">Urbanization</option>
        <option value="medianAge">Median age</option>
      </select>

      {value !== "none" && (
        <div style={{ marginTop: 8 }}>
          <div style={{ height: 8, borderRadius: 4, width: "100%", minWidth: 120, background: `linear-gradient(to right, ${stops[value].join(", ")})` }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
            <span style={{ fontSize: 9, color: "#8a857a" }}>{labels[value][0]}</span>
            <span style={{ fontSize: 9, color: "#8a857a" }}>{labels[value][1]}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function HoverTooltip({ countryName }) {
  if (!countryName) return null;
  return (
    <div style={{
      position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)",
      background: "#fff", padding: "6px 14px", borderRadius: 6,
      boxShadow: "0 1px 6px rgba(0,0,0,0.1)", border: "1px solid #e0dbd3",
      fontSize: 13, color: "#3d3a35", fontWeight: 600, pointerEvents: "none"
    }}>{countryName}</div>
  );
}

export function ClickHint({ visible }) {
  if (!visible) return null;
  return (
    <div style={{
      position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
      color: "#a9a49a", fontSize: 14, fontStyle: "italic", pointerEvents: "none", textAlign: "center"
    }}>Click any country to explore</div>
  );
}
