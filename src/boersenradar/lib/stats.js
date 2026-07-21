// Kennzahlen zur Modell-Performance.

const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

export function computeStats(forecasts, { sinceDays = null } = {}) {
  let closed = forecasts.filter((f) => f.status !== 'offen' && f.result);
  if (sinceDays != null) {
    const cutoff = Date.now() - sinceDays * 86_400_000;
    closed = closed.filter((f) => new Date(f.result.evaluatedAt).getTime() >= cutoff);
  }
  const hits = closed.filter((f) => f.status === 'richtig').length;
  const dirReturns = closed.map((f) => f.result.directionalReturnPct).filter((v) => v != null);
  const alphas = closed.map((f) => f.result.alphaPct).filter((v) => v != null);
  return {
    total: closed.length,
    hits,
    hitRate: closed.length ? (hits / closed.length) * 100 : null,
    avgReturn: avg(dirReturns),
    avgAlpha: avg(alphas),
  };
}

export function statsByKey(forecasts, events, keyFn) {
  const eventById = Object.fromEntries(events.map((e) => [e.id, e]));
  const groups = {};
  for (const f of forecasts) {
    if (f.status === 'offen' || !f.result) continue;
    const key = keyFn(f, eventById[f.eventId]);
    if (key == null) continue;
    (groups[key] ??= []).push(f);
  }
  return Object.entries(groups)
    .map(([key, list]) => {
      const hits = list.filter((f) => f.status === 'richtig').length;
      return { key, total: list.length, hits, hitRate: (hits / list.length) * 100 };
    })
    .sort((a, b) => b.total - a.total);
}

// Kumulierte direktionale Rendite über der Zeit (je abgeschlossener Prognose),
// parallel dazu die kumulierte Benchmark-Rendite derselben Zeiträume.
export function cumulativeSeries(forecasts) {
  const closed = forecasts
    .filter((f) => f.status !== 'offen' && f.result?.directionalReturnPct != null)
    .sort((a, b) => new Date(a.result.evaluatedAt) - new Date(b.result.evaluatedAt));
  let acc = 0;
  let accBench = 0;
  return closed.map((f) => {
    acc += f.result.directionalReturnPct;
    accBench += f.result.benchmarkReturnPct ?? 0;
    return {
      ts: new Date(f.result.evaluatedAt).getTime(),
      label: f.symbol,
      cum: acc,
      cumBench: accBench,
    };
  });
}

// Trefferquote nach Konfidenz-Bucket – zeigt, ob die Konfidenz kalibriert ist.
export function calibration(forecasts) {
  const buckets = [
    { min: 0, max: 50, label: '< 50 %' },
    { min: 50, max: 70, label: '50–69 %' },
    { min: 70, max: 85, label: '70–84 %' },
    { min: 85, max: 101, label: '≥ 85 %' },
  ];
  return buckets
    .map((b) => {
      const list = forecasts.filter(
        (f) => f.status !== 'offen' && f.confidence >= b.min && f.confidence < b.max
      );
      const hits = list.filter((f) => f.status === 'richtig').length;
      return { key: b.label, total: list.length, hits, hitRate: list.length ? (hits / list.length) * 100 : null };
    })
    .filter((b) => b.total > 0);
}
