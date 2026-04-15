import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as d3 from "d3";

import { PERIODS_5YR, PERIODS_10YR, NUM_TO_ISO3, TOPO_URL } from "../data/constants";
import { getName } from "../utils/formatters";

import useMapData from "../hooks/useMapData";
import useMapColors from "../hooks/useMapColors";

import CountryPanel from "./CountryPanel";
import GraphBuilder from "./GraphBuilder";
import { ZoomControls, PeriodSelector, ChoroplethSelector, HoverTooltip, ClickHint } from "./MapControls";

export default function WorldMap() {
  const svgRef = useRef(null);
  const zoomRef = useRef(null);
  const choroplethRef = useRef({});
  const selectedRef = useRef(null);

  const [world, setWorld] = useState(null);
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [intervalMode, setIntervalMode] = useState("5yr");
  const [selectedPeriods, setSelectedPeriods] = useState(new Set(["2005"]));
  const [panelOpen, setPanelOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [choroplethMetric, setChoroplethMetric] = useState("none");
  const [stockSource, setStockSource] = useState("ims");
  const [mapSize, setMapSize] = useState({ width: innerWidth, height: innerHeight });

  const PERIODS = intervalMode === "10yr" ? PERIODS_10YR : PERIODS_5YR;
  const { migrationData, chartData, mData, chartInfo, confidence, confidenceMeta, sourceLabels, availableSources } = useMapData(intervalMode, selectedPeriods, selected, stockSource);
  const choroplethColors = useMapColors(choroplethMetric, migrationData, chartData, selectedPeriods);

  // period helpers
  const togglePeriod = useCallback(p => {
    setSelectedPeriods(prev => {
      const next = new Set(prev);
      next.has(p) ? (next.size > 1 && next.delete(p)) : next.add(p);
      return next;
    });
  }, []);

  const toggleAllPeriods = useCallback(() => {
    if (selectedPeriods.size === PERIODS.length) {
      setSelectedPeriods(new Set([intervalMode === "10yr" ? "2000" : "2005"]));
    } else {
      setSelectedPeriods(new Set(PERIODS));
    }
  }, [selectedPeriods.size, PERIODS, intervalMode]);

  const switchInterval = useCallback(mode => {
    setIntervalMode(mode);
    setSelectedPeriods(new Set([mode === "10yr" ? "2000" : "2005"]));
  }, []);

  const sortedPeriods = useMemo(() => PERIODS.filter(p => selectedPeriods.has(p)), [selectedPeriods, PERIODS]);

  const periodLabel = useMemo(() => {
    const s = sortedPeriods;
    const step = intervalMode === "10yr" ? 10 : 5;
    if (!s.length) return "";
    if (s.length === 1) return s[0] + "–" + (+s[0] + step);
    return s[0] + "–" + (+s[s.length - 1] + step);
  }, [sortedPeriods, intervalMode]);

  // window resize
  useEffect(() => {
    const fn = () => setMapSize({ width: innerWidth, height: innerHeight });
    addEventListener("resize", fn);
    return () => removeEventListener("resize", fn);
  }, []);

  // load topojson
  useEffect(() => {
    fetch(TOPO_URL).then(r => r.json()).then(setWorld).catch(console.error);
  }, []);

  // d3 map rendering
  useEffect(() => {
    if (!world || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("class", "map-group");
    const proj = d3.geoNaturalEarth1().fitSize([mapSize.width, mapSize.height * 0.95], { type: "Sphere" });
    const pathGen = d3.geoPath(proj);

    // inline topojson decode (avoids pulling in the whole topojson library)
    const decode = (topo, obj) => {
      const { arcs, transform: tx } = topo;
      const decodeArc = idx => {
        const rev = idx < 0;
        const arc = arcs[rev ? ~idx : idx];
        if (!arc) return [];
        let x = 0, y = 0;
        const pts = arc.map(([dx, dy]) => {
          x += dx; y += dy;
          return tx ? [x * tx.scale[0] + tx.translate[0], y * tx.scale[1] + tx.translate[1]] : [x, y];
        });
        return rev ? pts.reverse() : pts;
      };
      return {
        type: "FeatureCollection",
        features: obj.geometries.map(geo => ({
          type: "Feature", id: geo.id, properties: geo.properties || {},
          geometry: geo.type === "Polygon"
            ? { type: "Polygon", coordinates: geo.arcs.map(ring => ring.flatMap(decodeArc)) }
            : geo.type === "MultiPolygon"
            ? { type: "MultiPolygon", coordinates: geo.arcs.map(poly => poly.map(ring => ring.flatMap(decodeArc))) }
            : null
        }))
      };
    };

    const geo = decode(world, world.objects.countries);

    // background layers
    g.append("path").datum({ type: "Sphere" })
      .attr("d", pathGen).attr("fill", "#f5f2ed").attr("stroke", "#c4bfb4").attr("stroke-width", 0.5);
    g.append("path").datum(d3.geoGraticule()())
      .attr("d", pathGen).attr("fill", "none").attr("stroke", "#d5d0c4").attr("stroke-width", 0.3);

    // countries
    g.selectAll("path.country")
      .data(geo.features.filter(f => f.geometry))
      .join("path")
      .attr("class", "country")
      .attr("d", pathGen)
      .attr("fill", d => choroplethRef.current[NUM_TO_ISO3[String(+d.id)]] || "#e8e4dc")
      .attr("stroke", "#c4bfb4").attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("click", (_, d) => {
        const iso = NUM_TO_ISO3[String(+d.id)];
        if (iso) { setSelected(iso); setPanelOpen(true); }
      })
      .on("mouseenter", (ev, d) => {
        setHovered(NUM_TO_ISO3[String(+d.id)]);
        d3.select(ev.target).attr("stroke-width", 1.5);
      })
      .on("mouseleave", (ev, d) => {
        setHovered(null);
        const iso = NUM_TO_ISO3[String(+d.id)];
        d3.select(ev.target).attr("stroke-width", iso === selectedRef.current ? 1.5 : 0.5);
      });

    const zoom = d3.zoom().scaleExtent([1, 8]).on("zoom", e => g.attr("transform", e.transform));
    svg.call(zoom);
    zoomRef.current = zoom;
  }, [world, mapSize]);

  // repaint on selection / choropleth change
  useEffect(() => {
    choroplethRef.current = choroplethColors;
    selectedRef.current = selected;
    if (!svgRef.current) return;
    d3.select(svgRef.current).selectAll("path.country")
      .attr("fill", function (d) {
        const iso = NUM_TO_ISO3[String(+d.id)];
        if (iso === selected) return "#b8b0a0";
        return choroplethColors[iso] || "#e8e4dc";
      })
      .attr("stroke-width", function (d) {
        return NUM_TO_ISO3[String(+d.id)] === selected ? 1.5 : 0.5;
      });
  }, [selected, choroplethColors]);

  // zoom buttons
  const zoomIn = () => svgRef.current && zoomRef.current &&
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.5);
  const zoomOut = () => svgRef.current && zoomRef.current &&
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.67);
  const zoomReset = () => svgRef.current && zoomRef.current &&
    d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity);

  return (
    <div style={{
      width: "100vw", height: "100vh", position: "fixed", top: 0, left: 0,
      fontFamily: "'Source Sans 3', sans-serif", background: "#f5f2ed", overflow: "hidden"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;600;700&family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet" />

      <div style={{ position: "absolute", inset: 0 }}>
        <svg ref={svgRef} width={mapSize.width} height={mapSize.height} style={{ display: "block" }} />

        {/* title */}
        <div style={{ position: "absolute", top: 16, left: 20, fontFamily: "'Source Serif 4', serif", fontSize: 22, fontWeight: 600, color: "#3d3a35", letterSpacing: "-0.02em" }}>
          World Migration Atlas
          <div style={{ fontSize: 12, fontWeight: 400, color: "#8a857a", fontFamily: "'Source Sans 3', sans-serif", marginTop: 2 }}>
            Bilateral flows &amp; demographics · 1960–2010
          </div>
        </div>

        <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={zoomReset} />
        <ChoroplethSelector value={choroplethMetric} onChange={setChoroplethMetric} panelOpen={panelOpen} />

        <button onClick={() => setGraphOpen(o => !o)} style={{
          position: "absolute", top: 70, left: 20, background: graphOpen ? "#3d3a35" : "#fff",
          color: graphOpen ? "#fff" : "#3d3a35", border: "1px solid #c4bfb4", borderRadius: 8,
          padding: "8px 12px", fontSize: 11, fontWeight: 600, fontFamily: "'Source Sans 3', sans-serif",
          cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s"
        }}>
          <span style={{ fontSize: 14 }}>📊</span> Graph Builder
        </button>

        <button onClick={() => selected && setPanelOpen(o => !o)} style={{
          position: "absolute", top: 110, right: panelOpen ? 450 : 20,
          background: panelOpen ? "#3d3a35" : "#fff",
          color: panelOpen ? "#fff" : (selected ? "#3d3a35" : "#a9a49a"),
          border: "1px solid #c4bfb4", borderRadius: 8, padding: "8px 12px",
          fontSize: 11, fontWeight: 600, fontFamily: "'Source Sans 3', sans-serif",
          cursor: selected ? "pointer" : "default", boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          display: "flex", alignItems: "center", gap: 6,
          transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)", opacity: selected ? 1 : 0.7
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
            {!panelOpen && <line x1="12" y1="8" x2="12" y2="16" />}
          </svg>
          {selected ? getName(selected) : "Click on any country"}
        </button>

        <PeriodSelector selectedPeriods={selectedPeriods} onTogglePeriod={togglePeriod}
          onToggleAll={toggleAllPeriods} intervalMode={intervalMode}
          onIntervalChange={switchInterval} periods={PERIODS}
          stockSource={stockSource} onStockSourceChange={setStockSource}
          sourceLabels={sourceLabels} availableSources={availableSources} />
        <HoverTooltip countryName={hovered ? getName(hovered) : null} />
        <ClickHint visible={!selected} />
      </div>

      <CountryPanel selected={selected} panelOpen={panelOpen} onClose={() => setPanelOpen(false)}
        periodLabel={periodLabel} sortedPeriods={sortedPeriods} selectedPeriods={selectedPeriods}
        mData={mData} chartInfo={chartInfo} intervalMode={intervalMode}
        confidence={confidence} confidenceMeta={confidenceMeta} />

      <GraphBuilder open={graphOpen} onClose={() => setGraphOpen(false)} selected={selected}
        chartInfo={chartInfo} migrationData={migrationData} intervalMode={intervalMode}
        selectedPeriods={selectedPeriods} />
    </div>
  );
}