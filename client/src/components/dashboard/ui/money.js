// Single money formatter for the whole dashboard (display only — no logic change).
export function fmtMoney(value, { decimals = false } = {}) {
  const n = Number(value || 0);
  return `₹${n.toLocaleString('en-IN', decimals
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : { maximumFractionDigits: 0 })}`;
}

export default fmtMoney;
