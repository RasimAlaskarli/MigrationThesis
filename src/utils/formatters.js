import { CODE_TO_NAME } from '../data/constants';

/**
 * Format a number for display (e.g., 1500000 -> "1.5M")
 */
export function formatNum(n) {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1000000) return sign + (abs / 1000000).toFixed(1) + "M";
  if (abs >= 1000) return sign + (abs / 1000).toFixed(1) + "K";
  return n.toLocaleString();
}

/**
 * Get country name from ISO3 code
 */
export function getName(code) {
  return CODE_TO_NAME[code] || code;
}