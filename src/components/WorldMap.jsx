import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as d3 from "d3";

// Data and constants
import { PERIODS_5YR, PERIODS_10YR, NUM_TO_ISO3, TOPO_URL, HISTORICAL_TO_MODERN, MODERN_TO_HISTORICAL } from "../data/constants";
import { getName } from "../utils/formatters";

// Components
import CountryPanel from "./CountryPanel";
import GraphBuilder from "./GraphBuilder";
import {
  ZoomControls,
  PeriodSelector,
  ChoroplethSelector,
  HoverTooltip,
  ClickHint
} from "./MapControls";

/**
 * Main World Migration Atlas component
 */
export default function WorldMap() {
  // Refs
  const svgRef = useRef(null);
  const zoomRef = useRef(null);
  const choroplethRef = useRef({});
  const selectedRef = useRef(null);

  // State
  const [world, setWorld] = useState(null);
  const [migrationData5yr, setMigrationData5yr] = useState(null);
  const [migrationData10yr, setMigrationData10yr] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [intervalMode, setIntervalMode] = useState("5yr");
  const [selectedPeriods, setSelectedPeriods] = useState(new Set(["2005"]));
  const [panelOpen, setPanelOpen] = useState(false);
  const [choroplethMetric, setChoroplethMetric] = useState("none");
  const [graphBuilderOpen, setGraphBuilderOpen] = useState(false);
  const [mapSize, setMapSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Derived: active periods list and migration data based on interval mode
  const PERIODS = intervalMode === "10yr" ? PERIODS_10YR : PERIODS_5YR;
  const migrationData = intervalMode === "10yr" ? migrationData10yr : migrationData5yr;

  // Toggle period selection
  const togglePeriod = useCallback((p) => {
    setSelectedPeriods(prev => {
      const next = new Set(prev);
      if (next.has(p)) {
        if (next.size > 1) next.delete(p);
      } else {
        next.add(p);
      }
      return next;
    });
  }, []);

  // Toggle all periods
  const toggleAllPeriods = useCallback(() => {
    if (selectedPeriods.size === PERIODS.length) {
      const defaultPeriod = intervalMode === "10yr" ? "2000" : "2005";
      setSelectedPeriods(new Set([defaultPeriod]));
    } else {
      setSelectedPeriods(new Set(PERIODS));
    }
  }, [selectedPeriods.size, PERIODS, intervalMode]);

  // Switch between 5-year and 10-year intervals
  const handleIntervalChange = useCallback((mode) => {
    setIntervalMode(mode);
    // Reset selection to the last available period in the new mode
    const defaultPeriod = mode === "10yr" ? "2000" : "2005";
    setSelectedPeriods(new Set([defaultPeriod]));
  }, []);

  // Sorted periods for display
  const sortedPeriods = useMemo(() =>
    PERIODS.filter(p => selectedPeriods.has(p)), [selectedPeriods, PERIODS]);

  // Period label for panel header
  const periodLabel = useMemo(() => {
    const sorted = sortedPeriods;
    const step = intervalMode === "10yr" ? 10 : 5;
    if (sorted.length === 0) return "";
    if (sorted.length === 1) return `${sorted[0]}–${parseInt(sorted[0]) + step}`;
    return `${sorted[0]}–${parseInt(sorted[sorted.length - 1]) + step}`;
  }, [sortedPeriods, intervalMode]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => setMapSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load TopoJSON world map
  useEffect(() => {
    fetch(TOPO_URL)
      .then(r => r.json())
      .then(data => setWorld(data))
      .catch(e => console.error("Failed to load world map:", e));
  }, []);

  // Load migration and chart data
  useEffect(() => {
    import("../data/migrationData_5yr.json")
      .then(m => setMigrationData5yr(m.default || m))
      .catch(() => {
        // Fallback to old single file
        import("../data/migrationData.json")
          .then(m => setMigrationData5yr(m.default || m))
          .catch(e => console.warn("5yr migration data not loaded:", e));
      });
    import("../data/migrationData_10yr.json")
      .then(m => setMigrationData10yr(m.default || m))
      .catch(e => console.warn("10yr migration data not loaded:", e));
    import("../data/chartData.json")
      .then(c => setChartData(c.default || c))
      .catch(e => console.warn("Chart data not loaded:", e));
  }, []);

  // Choropleth color scale
  const choroplethColors = useMemo(() => {
    const colors = {};
    if (choroplethMetric === "none") return colors;

    const values = {};

    if (choroplethMetric === "netMigration" && migrationData) {
      for (const p of selectedPeriods) {
        const pd = migrationData[p];
        if (!pd) continue;
        for (const [code, d] of Object.entries(pd)) {
          const mapCode = HISTORICAL_TO_MODERN[code] || code;
          values[mapCode] = (values[mapCode] || 0) + (d.ti || 0) - (d.to || 0);
        }
      }
    } else if (choroplethMetric === "totalImmigration" && migrationData) {
      for (const p of selectedPeriods) {
        const pd = migrationData[p];
        if (!pd) continue;
        for (const [code, d] of Object.entries(pd)) {
          const mapCode = HISTORICAL_TO_MODERN[code] || code;
          values[mapCode] = (values[mapCode] || 0) + (d.ti || 0);
        }
      }
    } else if (choroplethMetric === "totalEmigration" && migrationData) {
      for (const p of selectedPeriods) {
        const pd = migrationData[p];
        if (!pd) continue;
        for (const [code, d] of Object.entries(pd)) {
          const mapCode = HISTORICAL_TO_MODERN[code] || code;
          values[mapCode] = (values[mapCode] || 0) + (d.to || 0);
        }
      }
    } else if (chartData) {
      const metric = choroplethMetric === "unemployment" ? "unemployment"
        : choroplethMetric === "urbanization" ? "urbanization"
        : choroplethMetric === "medianAge" ? "medianAge" : null;
      if (metric) {
        for (const [code, d] of Object.entries(chartData)) {
          if (!d[metric]) continue;
          const vals = Array.from(selectedPeriods).map(p => d[metric][p]).filter(v => v != null);
          if (vals.length > 0) {
            values[code] = vals.reduce((a, b) => a + b, 0) / vals.length;
          }
        }
      }
    }

    const vals = Object.values(values).filter(v => v !== 0 && isFinite(v));
    if (vals.length === 0) return colors;

    if (choroplethMetric === "netMigration") {
      const absMax = Math.max(
        Math.abs(d3.quantile(vals.sort(d3.ascending), 0.05)),
        Math.abs(d3.quantile(vals, 0.95))
      );
      const scale = d3.scaleLinear()
        .domain([-absMax, 0, absMax])
        .range(["#c44e52", "#f5f2ed", "#4878a8"])
        .clamp(true);
      for (const [code, val] of Object.entries(values)) {
        colors[code] = scale(val);
      }
    } else {
      const [lo, hi] = [d3.quantile(vals.sort(d3.ascending), 0.05), d3.quantile(vals, 0.95)];
      const colorRange = choroplethMetric === "unemployment" || choroplethMetric === "totalEmigration"
        ? ["#fef0e4", "#c2703e"]
        : choroplethMetric === "urbanization" || choroplethMetric === "totalImmigration"
        ? ["#eef4ef", "#2d6a3f"]
        : ["#eef1f4", "#3d5a72"];
      const scale = d3.scaleLinear().domain([lo, hi]).range(colorRange).clamp(true);
      for (const [code, val] of Object.entries(values)) {
        colors[code] = scale(val);
      }
    }

    return colors;
  }, [choroplethMetric, migrationData, chartData, selectedPeriods]);

  // Render map with D3
  useEffect(() => {
    if (!world || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("class", "map-group");
    const projection = d3.geoNaturalEarth1()
      .fitSize([mapSize.width, mapSize.height * 0.95], { type: "Sphere" });
    const path = d3.geoPath(projection);

    // TopoJSON to GeoJSON conversion
    const topoFeature = (topo, obj) => {
      const arcs = topo.arcs;
      const decodeArc = (arcIndex) => {
        const reverse = arcIndex < 0;
        const arc = arcs[reverse ? ~arcIndex : arcIndex];
        if (!arc) return [];
        let x = 0, y = 0;
        const coords = arc.map(([dx, dy]) => {
          x += dx;
          y += dy;
          const [sx, sy] = topo.transform
            ? [x * topo.transform.scale[0] + topo.transform.translate[0],
               y * topo.transform.scale[1] + topo.transform.translate[1]]
            : [x, y];
          return [sx, sy];
        });
        return reverse ? coords.reverse() : coords;
      };
      const decodeRing = (ring) => ring.flatMap(decodeArc);
      const decodePolygon = (polygon) => polygon.map(decodeRing);
      const decodeMultiPolygon = (multiPolygon) => multiPolygon.map(decodePolygon);

      return {
        type: "FeatureCollection",
        features: obj.geometries.map(geom => ({
          type: "Feature",
          id: geom.id,
          properties: geom.properties || {},
          geometry: geom.type === "Polygon"
            ? { type: "Polygon", coordinates: decodePolygon(geom.arcs) }
            : geom.type === "MultiPolygon"
            ? { type: "MultiPolygon", coordinates: decodeMultiPolygon(geom.arcs) }
            : null
        }))
      };
    };

    const features = topoFeature(world, world.objects.countries);

    g.selectAll("path.country")
      .data(features.features.filter(f => f.geometry))
      .join("path")
      .attr("class", "country")
      .attr("d", path)
      .attr("fill", d => {
        const iso3 = NUM_TO_ISO3[String(parseInt(d.id, 10))];
        if (choroplethRef.current[iso3]) return choroplethRef.current[iso3];
        return "#e8e4dc";
      })
      .attr("stroke", "#c4bfb4")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        const iso3 = NUM_TO_ISO3[String(parseInt(d.id, 10))];
        if (iso3) {
          setSelected(iso3);
          setPanelOpen(true);
        }
      })
      .on("mouseenter", (event, d) => {
        const iso3 = NUM_TO_ISO3[String(parseInt(d.id, 10))];
        setHovered(iso3);
        d3.select(event.target).attr("stroke-width", 1.5);
      })
      .on("mouseleave", (event, d) => {
        setHovered(null);
        const iso3 = NUM_TO_ISO3[String(parseInt(d.id, 10))];
        d3.select(event.target).attr("stroke-width", iso3 === selectedRef.current ? 1.5 : 0.5);
      });

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoom);
    zoomRef.current = zoom;

    // Graticule
    const graticule = d3.geoGraticule();
    g.insert("path", "path.country")
      .datum(graticule())
      .attr("class", "graticule")
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", "#d5d0c4")
      .attr("stroke-width", 0.3);

    // Sphere outline
    g.insert("path", "path.graticule")
      .datum({ type: "Sphere" })
      .attr("class", "sphere")
      .attr("d", path)
      .attr("fill", "#f5f2ed")
      .attr("stroke", "#c4bfb4")
      .attr("stroke-width", 0.5);

  }, [world, mapSize]);

  // Update country colors for selection + choropleth
  useEffect(() => {
    choroplethRef.current = choroplethColors;
    selectedRef.current = selected;
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("path.country")
      .attr("fill", function(d) {
        const iso3 = NUM_TO_ISO3[String(parseInt(d.id, 10))];
        if (iso3 === selected) return "#b8b0a0";
        if (choroplethColors[iso3]) return choroplethColors[iso3];
        return "#e8e4dc";
      })
      .attr("stroke-width", function(d) {
        const iso3 = NUM_TO_ISO3[String(parseInt(d.id, 10))];
        return iso3 === selected ? 1.5 : 0.5;
      });
  }, [selected, choroplethColors]);

  // Migration data aggregated across selected periods
  const mData = useMemo(() => {
    if (!migrationData || !selected) return null;
    const historicalCode = MODERN_TO_HISTORICAL[selected];
    let ti = 0, to = 0;
    const ai = {}, ao = {};
    for (const p of selectedPeriods) {
      // Try the selected code first, then fall back to historical code
      const pd = migrationData[p]?.[selected] || (historicalCode ? migrationData[p]?.[historicalCode] : null);
      if (!pd) continue;
      ti += pd.ti || 0;
      to += pd.to || 0;
      if (pd.ai) {
        for (const [k, v] of Object.entries(pd.ai)) {
          // Remap historical codes in bilateral partners to modern codes
          const mapK = HISTORICAL_TO_MODERN[k] || k;
          ai[mapK] = (ai[mapK] || 0) + v;
        }
      }
      if (pd.ao) {
        for (const [k, v] of Object.entries(pd.ao)) {
          const mapK = HISTORICAL_TO_MODERN[k] || k;
          ao[mapK] = (ao[mapK] || 0) + v;
        }
      }
    }
    if (ti === 0 && to === 0) return null;
    return {
      ti, to, ai, ao,
      usesHistoricalData: historicalCode && !migrationData[Array.from(selectedPeriods)[0]]?.[selected]
    };
  }, [migrationData, selected, selectedPeriods]);

  // Chart info for selected country
  const chartInfo = useMemo(() => {
    if (!chartData || !selected) return null;
    return chartData[selected] || null;
  }, [chartData, selected]);

  // Zoom handlers
  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.5);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.67);
    }
  };

  const handleReset = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  // Close panel handler
  const handleClosePanel = () => {
    setPanelOpen(false);
  };

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      position: "fixed",
      top: 0,
      left: 0,
      fontFamily: "'Source Sans 3', sans-serif",
      background: "#f5f2ed",
      overflow: "hidden"
    }}>
      {/* Google Fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;600;700&family=Source+Serif+4:wght@400;600&display=swap"
        rel="stylesheet"
      />

      {/* Map container */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <svg ref={svgRef} width={mapSize.width} height={mapSize.height} style={{ display: "block" }} />

        {/* Title */}
        <div style={{
          position: "absolute",
          top: 16,
          left: 20,
          fontFamily: "'Source Serif 4', serif",
          fontSize: 22,
          fontWeight: 600,
          color: "#3d3a35",
          letterSpacing: "-0.02em"
        }}>
          World Migration Atlas
          <div style={{
            fontSize: 12,
            fontWeight: 400,
            color: "#8a857a",
            fontFamily: "'Source Sans 3', sans-serif",
            marginTop: 2
          }}>
            Bilateral flows & demographics · 1960–{intervalMode === "10yr" ? "2010" : "2010"}
          </div>
        </div>

        {/* Controls */}
        <ZoomControls onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onReset={handleReset} />
        <ChoroplethSelector value={choroplethMetric} onChange={setChoroplethMetric} panelOpen={panelOpen} />

        {/* Graph Builder toggle button */}
        <button
          onClick={() => setGraphBuilderOpen(prev => !prev)}
          style={{
            position: "absolute",
            top: 70,
            left: 20,
            background: graphBuilderOpen ? "#3d3a35" : "#fff",
            color: graphBuilderOpen ? "#fff" : "#3d3a35",
            border: "1px solid #c4bfb4",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 11,
            fontWeight: 600,
            fontFamily: "'Source Sans 3', sans-serif",
            cursor: "pointer",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            letterSpacing: "0.02em",
            transition: "all 0.15s"
          }}
        >
          <span style={{ fontSize: 14 }}>📊</span> Graph Builder
        </button>

        {/* Country Info sidebar toggle */}
        <button
          onClick={() => {
            if (selected) setPanelOpen(prev => !prev);
          }}
          style={{
            position: "absolute",
            top: 110,
            right: panelOpen ? 450 : 20,
            background: panelOpen ? "#3d3a35" : "#fff",
            color: panelOpen ? "#fff" : selected ? "#3d3a35" : "#a9a49a",
            border: "1px solid #c4bfb4",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 11,
            fontWeight: 600,
            fontFamily: "'Source Sans 3', sans-serif",
            cursor: selected ? "pointer" : "default",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            letterSpacing: "0.02em",
            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            opacity: selected ? 1 : 0.7
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
            {!panelOpen && <line x1="12" y1="8" x2="12" y2="16" />}
          </svg>
          {selected ? getName(selected) : "Click on any country"}
        </button>
        <PeriodSelector
          selectedPeriods={selectedPeriods}
          onTogglePeriod={togglePeriod}
          onToggleAll={toggleAllPeriods}
          intervalMode={intervalMode}
          onIntervalChange={handleIntervalChange}
          periods={PERIODS}
        />
        <HoverTooltip countryName={hovered ? getName(hovered) : null} />
        <ClickHint visible={!selected} />
      </div>

      {/* Side Panel */}
      <CountryPanel
        selected={selected}
        panelOpen={panelOpen}
        onClose={handleClosePanel}
        periodLabel={periodLabel}
        sortedPeriods={sortedPeriods}
        selectedPeriods={selectedPeriods}
        mData={mData}
        chartInfo={chartInfo}
        intervalMode={intervalMode}
      />

      {/* Graph Builder */}
      <GraphBuilder
        open={graphBuilderOpen}
        onClose={() => setGraphBuilderOpen(false)}
        selected={selected}
        chartInfo={chartInfo}
        migrationData={migrationData}
        intervalMode={intervalMode}
        selectedPeriods={selectedPeriods}
      />
    </div>
  );
}