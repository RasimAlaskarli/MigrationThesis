import { useState, useEffect, useMemo } from "react";
import { HISTORICAL_TO_MODERN, MODERN_TO_HISTORICAL } from "../data/constants";

/*
  Loads the two migration JSONs (5yr, 10yr) and chartData.
  
  The migration JSON has a mixed structure:
    - most periods are flat: { "1960": { "CZE": {ti, to, ai, ao}, ... } }
    - overlap periods (1990s) are nested: { "1990": { "wb": {...}, "un": {...} } }
  
  This hook resolves the overlap based on the stockSource prop,
  so the rest of the app always sees a flat { period: { country: data } } shape.
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
          .then(m => setMig5(m.default || m)).catch(() => {});
      });
    import("../data/migrationData_10yr.json")
      .then(m => setMig10(m.default || m)).catch(() => {});
    import("../data/chartData.json")
      .then(c => setChartData(c.default || c)).catch(() => {});
  }, []);

  const rawMig = intervalMode === "10yr" ? mig10 : mig5;

  // resolve nested overlap periods into flat structure
  const migrationData = useMemo(() => {
    if (!rawMig) return null;
    const resolved = {};
    for (const [period, data] of Object.entries(rawMig)) {
      // check if this period has the nested wb/un structure
      if (data && ("wb" in data || "un" in data)) {
        // pick whichever source the user selected, fall back to the other
        resolved[period] = data[stockSource] || data.wb || data.un;
      } else {
        resolved[period] = data;
      }
    }
    return resolved;
  }, [rawMig, stockSource]);

  // aggregate migration for selected country + periods
  const mData = useMemo(() => {
    if (!migrationData || !selected) return null;
    const fallback = MODERN_TO_HISTORICAL[selected];
    let ti = 0, to = 0, ai = {}, ao = {};
    let usedFallback = false;

    for (const period of selectedPeriods) {
      let pd = migrationData[period]?.[selected];
      if (!pd && fallback) {
        pd = migrationData[period]?.[fallback];
        if (pd) usedFallback = true;
      }
      if (!pd) continue;

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

    if (ti === 0 && to === 0) return null;
    return { ti, to, ai, ao, usesHistoricalData: usedFallback };
  }, [migrationData, selected, selectedPeriods]);

  const chartInfo = useMemo(() => {
    if (!chartData || !selected) return null;
    return chartData[selected] || null;
  }, [chartData, selected]);

  return { migrationData, chartData, mData, chartInfo };
}