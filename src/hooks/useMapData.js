import { useState, useEffect, useMemo } from "react";
import { HISTORICAL_TO_MODERN, MODERN_TO_HISTORICAL } from "../data/constants";

/*
  The migration JSON can contain:
    - flat yearly blocks
    - overlap blocks with source keys like wb / un / ims
    - _confidence
    - _confidence_meta
    - _meta.source_labels
    - _meta.year_source_options
*/

export default function useMapData(intervalMode, selectedPeriods, selected, stockSource) {
  const [mig5, setMig5] = useState(null);
  const [mig10, setMig10] = useState(null);
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    import("../data/migrationData_5yr.json")
      .then(m => setMig5(m.default || m))
      .catch(() => {
        import("../data/migrationData.json")
          .then(m => setMig5(m.default || m))
          .catch(() => {});
      });

    import("../data/migrationData_10yr.json")
      .then(m => setMig10(m.default || m))
      .catch(() => {});

    import("../data/chartData.json")
      .then(c => setChartData(c.default || c))
      .catch(() => {});
  }, []);

  const rawMig = intervalMode === "10yr" ? mig10 : mig5;

  const rawConfidence = useMemo(() => rawMig?._confidence || null, [rawMig]);

  // merge confidence maps for all selected periods into a single lookup
  // if a corridor is flagged in ANY selected period, show the worst level
  const confidence = useMemo(() => {
    if (!rawConfidence) return null;
    const merged = {};
    const severity = { "unreliable": 2, "no-reference": 1 };
    for (const period of selectedPeriods) {
      const periodConf = rawConfidence[period];
      if (!periodConf) continue;
      for (const [key, level] of Object.entries(periodConf)) {
        const existing = merged[key];
        if (!existing || (severity[level] || 0) > (severity[existing] || 0)) {
          merged[key] = level;
        }
      }
    }
    return Object.keys(merged).length > 0 ? merged : null;
  }, [rawConfidence, selectedPeriods]);
  const confidenceMeta = useMemo(() => rawMig?._confidence_meta || null, [rawMig]);
  const sourceLabels = useMemo(() => rawMig?._meta?.source_labels || {}, [rawMig]);
  const yearSourceOptions = useMemo(() => rawMig?._meta?.year_source_options || {}, [rawMig]);

  const availableSources = useMemo(() => {
    const ordered = ["wb", "un", "ims"];
    const set = new Set();

    for (const period of selectedPeriods || []) {
      const opts = yearSourceOptions?.[period];
      if (Array.isArray(opts)) {
        opts.forEach(src => set.add(src));
      } else {
        const block = rawMig?.[period];
        if (block && typeof block === "object") {
          ordered.forEach(src => {
            if (src in block) set.add(src);
          });
        }
      }
    }

    return ordered.filter(src => set.has(src));
  }, [selectedPeriods, yearSourceOptions, rawMig]);

  const migrationData = useMemo(() => {
    if (!rawMig) return null;

    const resolved = {};
    for (const [period, data] of Object.entries(rawMig)) {
      if (period.startsWith("_")) continue;

      if (data && typeof data === "object" && ["wb", "un", "ims"].some(src => src in data)) {
        resolved[period] = data[stockSource]
          || data.ims
          || data.un
          || data.wb
          || {};
      } else {
        resolved[period] = data || {};
      }
    }
    return resolved;
  }, [rawMig, stockSource]);

const mData = useMemo(() => {
  if (!migrationData || !selected) return null;

  console.log("selected =", selected);
  console.log("selectedPeriods =", [...selectedPeriods]);
  console.log("stockSource =", stockSource);

  const fallback = MODERN_TO_HISTORICAL[selected];
  let ti = 0, to = 0;
  let ai = {}, ao = {};
  let usedFallback = false;

  for (const period of selectedPeriods) {
    let pd = migrationData[period]?.[selected];

    console.log("period =", period);
    console.log("migrationData[period] =", migrationData?.[period]);
    console.log("pd before fallback =", pd);

    if (!pd && fallback) {
      pd = migrationData[period]?.[fallback];
      if (pd) usedFallback = true;
      console.log("fallback =", fallback);
      console.log("pd after fallback =", pd);
    }

    if (!pd) {
      console.log("No data for this period/country");
      continue;
    }

    console.log("ti =", pd.ti, "to =", pd.to);
    console.log("ai keys =", Object.keys(pd.ai || {}).length);
    console.log("ao keys =", Object.keys(pd.ao || {}).length);

    ti += pd.ti || 0;
    to += pd.to || 0;

    for (const [k, v] of Object.entries(pd.ai || {})) {
      const mapped = HISTORICAL_TO_MODERN[k] || k;
      ai[mapped] = (ai[mapped] || 0) + v;
    }

    for (const [k, v] of Object.entries(pd.ao || {})) {
      const mapped = HISTORICAL_TO_MODERN[k] || k;
      ao[mapped] = (ao[mapped] || 0) + v;
    }
  }

  console.log("FINAL ti =", ti, "FINAL to =", to);

  if (ti === 0 && to === 0) return null;
  return { ti, to, ai, ao, usesHistoricalData: usedFallback };
}, [migrationData, selected, selectedPeriods, stockSource]);

  const chartInfo = useMemo(() => {
    if (!chartData || !selected) return null;
    return chartData[selected] || null;
  }, [chartData, selected]);

  return {
    migrationData,
    chartData,
    mData,
    chartInfo,
    confidence,
    confidenceMeta,
    sourceLabels,
    availableSources,
  };
}