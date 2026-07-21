// Auswertung fälliger Prognosen gegen tatsächliche Kursentwicklung + Benchmark.

import { fetchHistory, firstCloseAtOrAfter, lastCloseAtOrBefore } from './quotes';

// Toleranzband für "halten": ±2 % gilt als Seitwärtsbewegung
const HOLD_BAND_PCT = 2;

export function verdictFor(direction, returnPct) {
  if (returnPct == null) return null;
  if (direction === 'kauf') return returnPct > 0 ? 'richtig' : 'falsch';
  if (direction === 'verkauf') return returnPct < 0 ? 'richtig' : 'falsch';
  return Math.abs(returnPct) <= HOLD_BAND_PCT ? 'richtig' : 'falsch';
}

// Direktionale Rendite: was hätte die Empfehlung gebracht?
// Kauf -> +Rendite, Verkauf -> -Rendite (Short), Halten -> nicht investiert (null).
export function directionalReturn(direction, returnPct) {
  if (returnPct == null) return null;
  if (direction === 'kauf') return returnPct;
  if (direction === 'verkauf') return -returnPct;
  return null;
}

async function evaluateOne(forecast, settings, historyCache) {
  const getHistory = async (symbol) => {
    const key = `${symbol}|${forecast.createdAt}|${forecast.dueAt}`;
    if (!historyCache.has(key)) {
      historyCache.set(key, await fetchHistory(symbol, forecast.createdAt, forecast.dueAt, settings));
    }
    return historyCache.get(key);
  };

  const series = await getHistory(forecast.symbol);
  const entry = forecast.entryPrice ?? firstCloseAtOrAfter(series, forecast.createdAt);
  const exit = lastCloseAtOrBefore(series, forecast.dueAt);
  if (!entry || !exit) throw new Error(`Kurse für ${forecast.symbol} unvollständig`);
  const returnPct = ((exit - entry) / entry) * 100;

  let benchmarkReturnPct = null;
  if (forecast.benchmarkSymbol) {
    try {
      const bSeries = await getHistory(forecast.benchmarkSymbol);
      const bEntry = forecast.entryBenchmark ?? firstCloseAtOrAfter(bSeries, forecast.createdAt);
      const bExit = lastCloseAtOrBefore(bSeries, forecast.dueAt);
      if (bEntry && bExit) benchmarkReturnPct = ((bExit - bEntry) / bEntry) * 100;
    } catch {
      // Benchmark nicht verfügbar -> Auswertung trotzdem durchführen
    }
  }

  const dirReturn = directionalReturn(forecast.direction, returnPct);
  return {
    evaluatedAt: new Date().toISOString(),
    entryPrice: entry,
    exitPrice: exit,
    returnPct,
    directionalReturnPct: dirReturn,
    benchmarkReturnPct,
    alphaPct: dirReturn != null && benchmarkReturnPct != null ? dirReturn - benchmarkReturnPct : null,
    verdict: verdictFor(forecast.direction, returnPct),
  };
}

// Wertet alle fälligen, offenen Prognosen aus.
// Rückgabe: { results: {forecastId: result}, errors: [msg] }
export async function evaluateDueForecasts(forecasts, settings) {
  const now = new Date().toISOString();
  const due = forecasts.filter((f) => f.status === 'offen' && f.dueAt <= now);
  const historyCache = new Map();
  const results = {};
  const errors = [];
  for (const f of due) {
    try {
      results[f.id] = await evaluateOne(f, settings, historyCache);
    } catch (e) {
      errors.push(`${f.symbol}: ${e.message}`);
    }
  }
  return { results, errors, dueCount: due.length };
}

// Zwischenstand für noch offene Prognosen (aktueller Kurs vs. Einstieg)
export function interimReturn(forecast, quote) {
  if (!quote?.price || !forecast.entryPrice) return null;
  return ((quote.price - forecast.entryPrice) / forecast.entryPrice) * 100;
}
