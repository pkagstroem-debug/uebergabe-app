// Event-Erfassung + KI-Prognosen pro Event

import React, { useState } from 'react';
import { useStore, getApiKey } from '../store';
import { generateForecasts } from '../lib/ai';
import { fetchQuote } from '../lib/quotes';
import {
  uuid,
  sha256Hex,
  forecastFingerprintPayload,
  CATEGORIES,
  HORIZONS,
  DIRECTIONS,
  fmtDate,
  addDays,
  horizonLabel,
} from '../lib/util';
import { Card, SectionTitle, Button, Input, Textarea, Select, Label, Badge, StatusBadge, EmptyHint } from '../components/ui';

async function buildForecast(base, settings) {
  // Einstiegskurse zum Zeitpunkt der Prognose einfrieren (best effort)
  let entryPrice = null;
  let entryBenchmark = null;
  try {
    entryPrice = (await fetchQuote(base.symbol, settings)).price;
  } catch {
    /* Auswertung fällt später auf historische Kurse zurück */
  }
  try {
    entryBenchmark = (await fetchQuote(settings.benchmarkSymbol, settings)).price;
  } catch {
    /* dito */
  }
  const createdAt = new Date().toISOString();
  const f = {
    id: uuid(),
    ...base,
    benchmarkSymbol: settings.benchmarkSymbol,
    entryPrice,
    entryBenchmark,
    createdAt,
    dueAt: addDays(createdAt, base.horizonDays),
    status: 'offen',
    result: null,
  };
  f.hash = await sha256Hex(forecastFingerprintPayload(f));
  return f;
}

function EventForm({ onSaved }) {
  const { dispatch } = useStore();
  const [form, setForm] = useState({
    title: '',
    date: new Date().toISOString().slice(0, 10),
    category: CATEGORIES[0],
    source: '',
    description: '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    dispatch({
      type: 'ADD_EVENT',
      event: { id: uuid(), ...form, title: form.title.trim(), createdAt: new Date().toISOString() },
    });
    setForm((f) => ({ ...f, title: '', source: '', description: '' }));
    onSaved?.();
  };

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div>
        <Label>Titel *</Label>
        <Input value={form.title} onChange={set('title')} placeholder="z. B. EZB senkt Leitzins um 25 Basispunkte" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Datum</Label>
          <Input type="date" value={form.date} onChange={set('date')} />
        </div>
        <div>
          <Label>Kategorie</Label>
          <Select value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label>Quelle</Label>
        <Input value={form.source} onChange={set('source')} placeholder="z. B. Reuters, Pressemitteilung, tagesschau.de" />
      </div>
      <div>
        <Label>Beschreibung</Label>
        <Textarea rows={3} value={form.description} onChange={set('description')} placeholder="Was ist passiert? Kontext, Zahlen, Erwartungen …" />
      </div>
      <Button type="submit">Event speichern</Button>
    </form>
  );
}

function ManualForecastForm({ event, onDone }) {
  const { state, dispatch } = useStore();
  const [form, setForm] = useState({ symbol: '', name: '', direction: 'kauf', reasoning: '', horizonDays: 7, confidence: 60 });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.symbol.trim() || !form.reasoning.trim()) return;
    setBusy(true);
    try {
      const forecast = await buildForecast(
        {
          eventId: event.id,
          symbol: form.symbol.trim().toUpperCase(),
          name: form.name.trim() || form.symbol.trim().toUpperCase(),
          direction: form.direction,
          reasoning: form.reasoning.trim(),
          horizonDays: Number(form.horizonDays),
          confidence: Math.max(0, Math.min(100, Number(form.confidence))),
          origin: 'manuell',
        },
        state.settings
      );
      dispatch({ type: 'ADD_FORECASTS', forecasts: [forecast] });
      onDone?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-2 mt-3 border-t border-white/10 pt-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Ticker (Yahoo) *</Label>
          <Input value={form.symbol} onChange={set('symbol')} placeholder="z. B. SAP.DE" required />
        </div>
        <div>
          <Label>Name</Label>
          <Input value={form.name} onChange={set('name')} placeholder="SAP SE" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label>Richtung</Label>
          <Select value={form.direction} onChange={set('direction')}>
            {Object.entries(DIRECTIONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Horizont</Label>
          <Select value={form.horizonDays} onChange={set('horizonDays')}>
            {HORIZONS.map((h) => (
              <option key={h.days} value={h.days}>
                {h.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Konfidenz (%)</Label>
          <Input type="number" min="0" max="100" value={form.confidence} onChange={set('confidence')} />
        </div>
      </div>
      <div>
        <Label>Begründung *</Label>
        <Textarea rows={2} value={form.reasoning} onChange={set('reasoning')} required />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? 'Speichere …' : 'Prognose einfrieren'}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

function EventCard({ event }) {
  const { state, dispatch } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const forecasts = state.forecasts.filter((f) => f.eventId === event.id);

  const runAi = async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setError('Kein Claude-API-Key hinterlegt – bitte zuerst in den Einstellungen eintragen.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ai = await generateForecasts(apiKey, event);
      dispatch({ type: 'SET_EVENT_AI_SUMMARY', id: event.id, summary: ai.einschaetzung });
      const built = [];
      for (const p of ai.prognosen) {
        built.push(
          await buildForecast(
            {
              eventId: event.id,
              symbol: p.symbol,
              name: p.name,
              direction: p.richtung,
              reasoning: p.begruendung,
              horizonDays: p.horizontTage,
              confidence: p.konfidenz,
              origin: 'ki',
            },
            state.settings
          )
        );
      }
      dispatch({ type: 'ADD_FORECASTS', forecasts: built });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-white">{event.title}</div>
          <div className="text-xs text-[#898781] mt-0.5">
            {fmtDate(event.date)} · {event.category}
            {event.source ? ` · Quelle: ${event.source}` : ''}
          </div>
        </div>
        <Button variant="danger" onClick={() => dispatch({ type: 'DELETE_EVENT', id: event.id })}>
          Löschen
        </Button>
      </div>
      {event.description && <p className="text-sm text-[#c3c2b7] mt-2 whitespace-pre-wrap">{event.description}</p>}
      {event.aiSummary && (
        <div className="mt-2 text-sm text-[#c3c2b7] bg-[#3987e5]/10 border border-[#3987e5]/20 rounded-lg p-2">
          <span className="text-xs font-medium text-[#3987e5]">KI-Einschätzung: </span>
          {event.aiSummary}
        </div>
      )}

      {forecasts.length > 0 && (
        <div className="mt-3 grid gap-1.5">
          {forecasts.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge status={f.status} />
              <Badge color={DIRECTIONS[f.direction].color}>{DIRECTIONS[f.direction].label}</Badge>
              <span className="text-white font-medium">{f.symbol}</span>
              <span className="text-[#898781] text-xs">
                {horizonLabel(f.horizonDays)} · Konfidenz {f.confidence} %
              </span>
            </div>
          ))}
        </div>
      )}

      {error && <div className="mt-2 text-sm text-[#e66767]">{error}</div>}

      <div className="flex gap-2 mt-3">
        <Button onClick={runAi} disabled={busy}>
          {busy ? 'KI analysiert …' : '🤖 KI-Prognose erstellen'}
        </Button>
        <Button variant="ghost" onClick={() => setShowManual((s) => !s)}>
          Manuell hinzufügen
        </Button>
      </div>
      {showManual && <ManualForecastForm event={event} onDone={() => setShowManual(false)} />}
    </Card>
  );
}

export default function Events() {
  const { state } = useStore();
  const [showForm, setShowForm] = useState(state.events.length === 0);

  return (
    <div className="grid gap-4">
      <Card>
        <SectionTitle
          right={
            <Button variant="ghost" onClick={() => setShowForm((s) => !s)}>
              {showForm ? 'Formular ausblenden' : '+ Neues Event'}
            </Button>
          }
        >
          Ereignis erfassen
        </SectionTitle>
        {showForm && <EventForm />}
      </Card>

      {state.events.length === 0 ? (
        <EmptyHint>
          Noch keine Events. Erfasse ein aktuelles Ereignis (Zinsentscheid, Quartalszahlen, Wahl …) und lass die KI
          eine Prognose dazu abgeben.
        </EmptyHint>
      ) : (
        state.events.map((e) => <EventCard key={e.id} event={e} />)
      )}
    </div>
  );
}
