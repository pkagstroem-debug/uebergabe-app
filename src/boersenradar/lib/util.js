// Hilfsfunktionen: IDs, Hashing, Formatierung, Datum

export const uuid = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// SHA-256-Fingerabdruck der eingefrorenen Prognose-Felder.
// Damit lässt sich nachträglich prüfen, dass eine Prognose nicht verändert wurde.
export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function forecastFingerprintPayload(f) {
  // Nur die inhaltlich relevanten, unveränderlichen Felder – in fester Reihenfolge.
  return JSON.stringify([
    f.id,
    f.eventId ?? null,
    f.symbol,
    f.name ?? '',
    f.direction,
    f.reasoning,
    f.horizonDays,
    f.confidence,
    f.createdAt,
    f.dueAt,
    f.entryPrice ?? null,
    f.benchmarkSymbol ?? null,
    f.entryBenchmark ?? null,
  ]);
}

export const fmtPct = (v, digits = 1) =>
  v == null || Number.isNaN(v)
    ? '–'
    : `${v > 0 ? '+' : ''}${v.toLocaleString('de-DE', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })} %`;

export const fmtPrice = (v, currency) =>
  v == null || Number.isNaN(v)
    ? '–'
    : `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${
        currency ? ` ${currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency}` : ''
      }`;

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–';

export const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '–';

export const addDays = (iso, days) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

export const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86_400_000);

export const HORIZONS = [
  { days: 1, label: '1 Tag' },
  { days: 7, label: '1 Woche' },
  { days: 30, label: '1 Monat' },
  { days: 90, label: '3 Monate' },
];

export const horizonLabel = (days) => HORIZONS.find((h) => h.days === days)?.label ?? `${days} Tage`;

export const CATEGORIES = [
  'Zinsentscheid',
  'Politik',
  'Wahl',
  'Geopolitik',
  'Quartalszahlen',
  'Regulierung',
  'Makro-Daten',
  'Unternehmensnachricht',
  'Sonstiges',
];

export const BENCHMARKS = [
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^GDAXI', label: 'DAX' },
  { symbol: '^NDX', label: 'Nasdaq 100' },
  { symbol: '^STOXX50E', label: 'Euro Stoxx 50' },
];

export const benchmarkLabel = (symbol) => BENCHMARKS.find((b) => b.symbol === symbol)?.label ?? symbol;

export const DIRECTIONS = {
  kauf: { label: 'Kauf', color: '#0ca30c' },
  verkauf: { label: 'Verkauf', color: '#d03b3b' },
  halten: { label: 'Halten', color: '#c98500' },
};
