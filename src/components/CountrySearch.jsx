import { useState, useMemo } from 'react';
import { CODE_TO_NAME } from '../data/constants';
import { formatNum, getName } from '../utils/formatters';

/**
 * Country search input with dropdown and bilateral flow display
 */
export default function CountrySearch({ selected, mData }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [pickedCountry, setPickedCountry] = useState(null);

  // All country codes except the selected one
  const allCountryCodes = useMemo(() => {
    return Object.keys(CODE_TO_NAME)
      .filter(c => c !== selected && c.length === 3)
      .sort((a, b) => getName(a).localeCompare(getName(b)));
  }, [selected]);

  // Filtered countries based on search query
  const filteredCountries = useMemo(() => {
    if (!searchQuery) return allCountryCodes.slice(0, 20);
    const q = searchQuery.toLowerCase();
    return allCountryCodes.filter(c => getName(c).toLowerCase().includes(q)).slice(0, 20);
  }, [searchQuery, allCountryCodes]);

  // Bilateral flow for picked country
  const bilateralFlow = useMemo(() => {
    if (!mData || !pickedCountry) return null;
    const fromPicked = mData.ai?.[pickedCountry] || 0;
    const toPicked = mData.ao?.[pickedCountry] || 0;
    return { from: fromPicked, to: toPicked };
  }, [mData, pickedCountry]);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 12,
        color: "#8a857a",
        marginBottom: 6,
        textTransform: "uppercase",
        letterSpacing: "0.03em"
      }}>
        Bilateral Flow
      </div>
      <input
        type="text"
        value={searchQuery}
        onChange={e => { setSearchQuery(e.target.value); setPickedCountry(null); }}
        placeholder="Search country..."
        style={{
          width: "100%",
          padding: "8px 12px",
          borderRadius: 6,
          border: "1px solid #d5d0c4",
          fontSize: 13,
          fontFamily: "'Source Sans 3', sans-serif",
          background: "#faf9f6",
          outline: "none",
          boxSizing: "border-box",
          color: "#3d3a35"
        }}
      />
      
      {/* Search dropdown */}
      {searchQuery && !pickedCountry && (
        <div style={{
          border: "1px solid #e0dbd3",
          borderRadius: 6,
          maxHeight: 160,
          overflowY: "auto",
          marginTop: 4,
          background: "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
        }}>
          {filteredCountries.map(c => (
            <div
              key={c}
              onClick={() => { setPickedCountry(c); setSearchQuery(getName(c)); }}
              style={{
                padding: "6px 12px",
                fontSize: 13,
                cursor: "pointer",
                borderBottom: "1px solid #f0ece6",
                color: "#3d3a35",
                background: "#fff"
              }}
              onMouseEnter={e => { e.target.style.background = "#f5f2ed"; }}
              onMouseLeave={e => { e.target.style.background = "#fff"; }}
            >
              {getName(c)}
            </div>
          ))}
        </div>
      )}

      {/* Bilateral flow display */}
      {bilateralFlow && pickedCountry && (
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #e8e4dc",
            background: "#faf9f6"
          }}>
            <div style={{ fontSize: 10, color: "#8a857a", textTransform: "uppercase" }}>
              {getName(pickedCountry)} → {getName(selected)}
            </div>
            <div style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#5a8a6a",
              fontFamily: "'Source Serif 4', serif"
            }}>
              {formatNum(bilateralFlow.from)}
            </div>
          </div>
          <div style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #e8e4dc",
            background: "#faf9f6"
          }}>
            <div style={{ fontSize: 10, color: "#8a857a", textTransform: "uppercase" }}>
              {getName(selected)} → {getName(pickedCountry)}
            </div>
            <div style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#c2703e",
              fontFamily: "'Source Serif 4', serif"
            }}>
              {formatNum(bilateralFlow.to)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
