// Kursdaten über die Yahoo-Finance-Chart-API (v8, ohne API-Key).
//
// CORS: Browser dürfen query1.finance.yahoo.com nicht direkt aufrufen.
// - Lokal (npm run dev / npm run preview) leitet der Vite-Proxy "/yahoo" weiter.
// - Bei statischem Hosting kann in den Einstellungen ein eigener Proxy-Prefix
//   hinterlegt werden (z. B. ein n8n-/Cloudflare-Worker, der die Anfrage durchreicht).

const DEFAULT_BASE = '/yahoo';

function baseUrl(settings) {
  const p = settings?.proxyPrefix?.trim();
  return p ? p.replace(/\/$/, '') : DEFAULT_BASE;
}

async function fetchChart(symbol, params, settings) {
  const qs = new URLSearchParams({ interval: '1d', events: '', ...params }).toString();
  const url = `${baseUrl(settings)}/v8/finance/chart/${encodeURIComponent(symbol)}?${qs}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Kursabruf für ${symbol} fehlgeschlagen (HTTP ${res.status})`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) {
    const msg = json?.chart?.error?.description || 'keine Daten';
    throw new Error(`Kursabruf für ${symbol}: ${msg}`);
  }
  return result;
}

// Aktueller Kurs + 1-Monats-Verlauf (für Watchlist & Sparkline) in einem Aufruf.
export async function fetchQuote(symbol, settings) {
  const result = await fetchChart(symbol, { range: '1mo' }, settings);
  const meta = result.meta ?? {};
  const closes = (result.indicators?.quote?.[0]?.close ?? []).filter((c) => c != null);
  const price = meta.regularMarketPrice ?? closes[closes.length - 1] ?? null;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
  // Tagesveränderung: gegen den letzten abweichenden Schlusskurs der Serie.
  const ref = closes.length >= 2 ? closes[closes.length - 2] : prevClose;
  return {
    symbol,
    name: meta.shortName || meta.longName || symbol,
    currency: meta.currency ?? null,
    price,
    changePct: price != null && ref ? ((price - ref) / ref) * 100 : null,
    spark: closes,
    ts: new Date().toISOString(),
  };
}

export async function fetchQuotes(symbols, settings) {
  const results = await Promise.allSettled(symbols.map((s) => fetchQuote(s, settings)));
  const quotes = {};
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') quotes[symbols[i]] = r.value;
    else errors.push(r.reason?.message ?? String(r.reason));
  });
  return { quotes, errors };
}

// Historische Tagesschlusskurse zwischen zwei Zeitpunkten: [{ts, close}, ...]
export async function fetchHistory(symbol, fromIso, toIso, settings) {
  const period1 = Math.floor(new Date(fromIso).getTime() / 1000) - 86_400;
  const period2 = Math.floor(new Date(toIso).getTime() / 1000) + 86_400;
  const result = await fetchChart(symbol, { period1, period2 }, settings);
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const series = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] != null) series.push({ ts: timestamps[i] * 1000, close: closes[i] });
  }
  if (!series.length) throw new Error(`Keine historischen Kurse für ${symbol}`);
  return series;
}

// Erster Schlusskurs an/nach einem Zeitpunkt (Einstieg, falls kein Live-Kurs gespeichert wurde)
export const firstCloseAtOrAfter = (series, iso) => {
  const t = new Date(iso).getTime();
  return series.find((p) => p.ts >= t)?.close ?? series[0]?.close ?? null;
};

// Letzter Schlusskurs an/vor einem Zeitpunkt (Bewertung am Fälligkeitstag)
export const lastCloseAtOrBefore = (series, iso) => {
  const t = new Date(iso).getTime();
  let last = null;
  for (const p of series) {
    if (p.ts <= t) last = p.close;
    else break;
  }
  return last ?? series[series.length - 1]?.close ?? null;
};
