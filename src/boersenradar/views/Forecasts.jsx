// Prognose-Übersicht: offen / abgeschlossen, Auswertung, Integritätsprüfung

import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { evaluateDueForecasts, interimReturn } from '../lib/evaluate';
import { sha256Hex, forecastFingerprintPayload, fmtPct, fmtPrice, fmtDateTime, fmtDate, horizonLabel, DIRECTIONS, benchmarkLabel } from '../lib/util';
import { Card, SectionTitle, Button, Badge, StatusBadge, EmptyHint } from '../components/ui';

function ForecastCard({ forecast, event, quote }) {
  const [integrity, setIntegrity] = useState(null);

  const checkIntegrity = async () => {
    const hash = await sha256Hex(forecastFingerprintPayload(forecast));
    setIntegrity(hash === forecast.hash ? 'ok' : 'tampered');
  };

  const interim = forecast.status === 'offen' ? interimReturn(forecast, quote) : null;
  const r = forecast.result;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={forecast.status} />
        <Badge color={DIRECTIONS[forecast.direction].color}>{DIRECTIONS[forecast.direction].label}</Badge>
        <span className="font-semibold text-white">{forecast.symbol}</span>
        <span className="text-sm text-[#c3c2b7]">{forecast.name}</span>
        <Badge color="#898781">{forecast.origin === 'ki' ? '🤖 KI' : '✍️ manuell'}</Badge>
      </div>

      <div className="text-xs text-[#898781] mt-1.5">
        Erstellt {fmtDateTime(forecast.createdAt)} · Horizont {horizonLabel(forecast.horizonDays)} · fällig{' '}
        {fmtDate(forecast.dueAt)} · Konfidenz {forecast.confidence} %
        {event && <> · Event: „{event.title}“</>}
      </div>

      <p className="text-sm text-[#c3c2b7] mt-2">{forecast.reasoning}</p>

      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <div>
          <div className="text-xs text-[#898781]">Einstieg</div>
          <div className="text-white">{fmtPrice(forecast.entryPrice)}</div>
        </div>
        {forecast.status === 'offen' ? (
          <div>
            <div className="text-xs text-[#898781]">Zwischenstand</div>
            <div style={{ color: interim == null ? '#c3c2b7' : interim >= 0 ? '#0ca30c' : '#e66767' }}>
              {fmtPct(interim)}
            </div>
          </div>
        ) : (
          <>
            <div>
              <div className="text-xs text-[#898781]">Ausstieg</div>
              <div className="text-white">{fmtPrice(r?.exitPrice)}</div>
            </div>
            <div>
              <div className="text-xs text-[#898781]">Kursentwicklung</div>
              <div style={{ color: (r?.returnPct ?? 0) >= 0 ? '#0ca30c' : '#e66767' }}>{fmtPct(r?.returnPct)}</div>
            </div>
            <div>
              <div className="text-xs text-[#898781]">vs. {benchmarkLabel(forecast.benchmarkSymbol)}</div>
              <div style={{ color: (r?.alphaPct ?? 0) >= 0 ? '#0ca30c' : '#e66767' }}>
                {r?.alphaPct != null ? `${fmtPct(r.alphaPct)} Alpha` : '–'}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <Button variant="ghost" onClick={checkIntegrity}>
          🔒 Integrität prüfen
        </Button>
        {integrity === 'ok' && <span className="text-xs text-[#0ca30c]">Prognose unverändert (Hash bestätigt)</span>}
        {integrity === 'tampered' && (
          <span className="text-xs text-[#e66767]">Achtung: Daten stimmen nicht mit dem Original-Hash überein!</span>
        )}
      </div>
    </Card>
  );
}

export default function Forecasts() {
  const { state, dispatch } = useStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [filter, setFilter] = useState('alle');

  const eventById = useMemo(() => Object.fromEntries(state.events.map((e) => [e.id, e])), [state.events]);
  const now = new Date().toISOString();
  const dueCount = state.forecasts.filter((f) => f.status === 'offen' && f.dueAt <= now).length;

  const evaluate = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { results, errors, dueCount: n } = await evaluateDueForecasts(state.forecasts, state.settings);
      const evaluated = Object.keys(results).length;
      if (evaluated) dispatch({ type: 'APPLY_RESULTS', results });
      setMsg(
        n === 0
          ? 'Keine fälligen Prognosen – Auswertung erfolgt automatisch nach Ablauf des Zeithorizonts.'
          : `${evaluated} von ${n} fälligen Prognosen ausgewertet.${errors.length ? ` Fehler: ${errors.join('; ')}` : ''}`
      );
    } catch (e) {
      setMsg(`Auswertung fehlgeschlagen: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const filtered = state.forecasts.filter((f) =>
    filter === 'alle' ? true : filter === 'offen' ? f.status === 'offen' : f.status !== 'offen'
  );

  return (
    <div className="grid gap-4">
      <Card>
        <SectionTitle
          right={
            <Button onClick={evaluate} disabled={busy}>
              {busy ? 'Werte aus …' : `Fällige auswerten${dueCount ? ` (${dueCount})` : ''}`}
            </Button>
          }
        >
          Prognosen
        </SectionTitle>
        <div className="flex gap-2">
          {['alle', 'offen', 'abgeschlossen'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-sm ${
                filter === f ? 'bg-[#3987e5] text-white' : 'bg-white/5 text-[#c3c2b7] hover:bg-white/10'
              }`}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {msg && <div className="text-sm text-[#c3c2b7] mt-2">{msg}</div>}
      </Card>

      {filtered.length === 0 ? (
        <EmptyHint>Keine Prognosen in dieser Ansicht. Lege unter „Events“ ein Ereignis an und erstelle Prognosen.</EmptyHint>
      ) : (
        filtered.map((f) => (
          <ForecastCard key={f.id} forecast={f} event={eventById[f.eventId]} quote={state.quotes[f.symbol]} />
        ))
      )}
    </div>
  );
}
