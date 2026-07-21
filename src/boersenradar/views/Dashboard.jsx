// Dashboard: Watchlist mit Kursen + Sparklines, offene Prognosen im Überblick

import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { fetchQuotes } from '../lib/quotes';
import { interimReturn } from '../lib/evaluate';
import { fmtPct, fmtPrice, fmtDate, DIRECTIONS } from '../lib/util';
import { Card, SectionTitle, Button, Input, Badge, EmptyHint } from '../components/ui';
import { Sparkline } from '../components/charts';

export default function Dashboard({ onNavigate }) {
  const { state, dispatch } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [newSymbol, setNewSymbol] = useState('');

  const openForecasts = state.forecasts.filter((f) => f.status === 'offen');
  const symbols = [...new Set([...state.watchlist, ...openForecasts.map((f) => f.symbol)])];

  const refresh = async () => {
    if (!symbols.length) return;
    setBusy(true);
    setError(null);
    const { quotes, errors } = await fetchQuotes(symbols, state.settings);
    if (Object.keys(quotes).length) dispatch({ type: 'SET_QUOTES', quotes });
    if (errors.length && !Object.keys(quotes).length) {
      setError(
        'Kursabruf fehlgeschlagen. Lokal bitte über „npm run dev“ starten (Proxy) oder in den Einstellungen einen CORS-Proxy hinterlegen.'
      );
    }
    setBusy(false);
  };

  // Beim Öffnen automatisch aktualisieren, wenn der Cache älter als 5 Minuten ist
  useEffect(() => {
    const newest = Math.max(0, ...Object.values(state.quotes).map((q) => new Date(q.ts).getTime()));
    if (Date.now() - newest > 5 * 60_000) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addSymbol = (e) => {
    e.preventDefault();
    const s = newSymbol.trim().toUpperCase();
    if (!s) return;
    dispatch({ type: 'ADD_WATCH', symbol: s });
    setNewSymbol('');
  };

  const dueCount = openForecasts.filter((f) => f.dueAt <= new Date().toISOString()).length;

  return (
    <div className="grid gap-4">
      {dueCount > 0 && (
        <button
          onClick={() => onNavigate('prognosen')}
          className="text-left rounded-xl border border-[#c98500]/40 bg-[#c98500]/10 p-3 text-sm text-[#c3c2b7]"
        >
          ⏰ <span className="text-white font-medium">{dueCount} Prognose(n) fällig</span> – jetzt unter „Prognosen“
          auswerten →
        </button>
      )}

      <Card>
        <SectionTitle
          right={
            <Button variant="ghost" onClick={refresh} disabled={busy}>
              {busy ? 'Lade …' : '↻ Aktualisieren'}
            </Button>
          }
        >
          Watchlist
        </SectionTitle>

        <form onSubmit={addSymbol} className="flex gap-2 mb-3">
          <Input
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            placeholder="Ticker hinzufügen, z. B. AAPL oder SAP.DE"
          />
          <Button type="submit" variant="ghost">
            +
          </Button>
        </form>

        {error && <div className="text-sm text-[#e66767] mb-2">{error}</div>}

        <div className="divide-y divide-white/5">
          {state.watchlist.map((symbol) => {
            const q = state.quotes[symbol];
            return (
              <div key={symbol} className="flex items-center gap-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{symbol}</div>
                  <div className="text-xs text-[#898781] truncate">{q?.name ?? '–'}</div>
                </div>
                <Sparkline data={q?.spark} />
                <div className="text-right w-24">
                  <div className="text-sm text-white">{fmtPrice(q?.price, q?.currency)}</div>
                  <div className="text-xs" style={{ color: (q?.changePct ?? 0) >= 0 ? '#0ca30c' : '#e66767' }}>
                    {fmtPct(q?.changePct)}
                  </div>
                </div>
                <button
                  onClick={() => dispatch({ type: 'REMOVE_WATCH', symbol })}
                  className="text-[#898781] hover:text-[#e66767] text-sm px-1"
                  title="Entfernen"
                >
                  ✕
                </button>
              </div>
            );
          })}
          {state.watchlist.length === 0 && <EmptyHint>Watchlist ist leer – Ticker oben hinzufügen.</EmptyHint>}
        </div>
      </Card>

      <Card>
        <SectionTitle
          right={
            <Button variant="ghost" onClick={() => onNavigate('prognosen')}>
              Alle →
            </Button>
          }
        >
          Offene Prognosen ({openForecasts.length})
        </SectionTitle>
        {openForecasts.length === 0 ? (
          <EmptyHint>Keine offenen Prognosen. Erfasse unter „Events“ ein Ereignis und lass die KI prognostizieren.</EmptyHint>
        ) : (
          <div className="grid gap-2">
            {openForecasts.slice(0, 8).map((f) => {
              const interim = interimReturn(f, state.quotes[f.symbol]);
              return (
                <div key={f.id} className="flex items-center gap-2 text-sm">
                  <Badge color={DIRECTIONS[f.direction].color}>{DIRECTIONS[f.direction].label}</Badge>
                  <span className="text-white font-medium">{f.symbol}</span>
                  <span className="text-xs text-[#898781] flex-1">fällig {fmtDate(f.dueAt)}</span>
                  <span style={{ color: interim == null ? '#898781' : interim >= 0 ? '#0ca30c' : '#e66767' }}>
                    {fmtPct(interim)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
