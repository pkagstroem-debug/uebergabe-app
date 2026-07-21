# KI-Börsenradar – Architektur & Datenquellen

Web-App zur Beobachtung und Bewertung von KI-Aktienprognosen auf Basis von
Live-Events. **Reines Paper-Trading / Prognose-Tracking – es wird kein echtes
Geld gehandelt. Keine Anlageberatung.**

## Schnellstart

```bash
npm install
npm run dev        # http://localhost:5173  → KI-Börsenradar
```

- `#/` → KI-Börsenradar (Standard auf diesem Branch)
- `#/uebergabe` → die bestehende Übergabe-App (unverändert enthalten)
- Für KI-Prognosen: Claude-API-Key unter **Setup** eintragen (bleibt lokal im Browser).

## Architektur-Entscheidung

**Frontend-only SPA (React + Vite + Tailwind), keine eigene Backend-Datenbank.**

Gründe:
- Passt zum bestehenden Repo (die Übergabe-App folgt demselben Muster).
- Ein Nutzer, private Daten → `localStorage` + JSON-Export/-Import reicht und
  vermeidet Hosting-/Betriebskosten und Auth-Aufwand.
- Beide externen Dienste (Börsenkurse, Claude API) sind direkt bzw. über einen
  schlanken Proxy aus dem Browser erreichbar.

```
┌─────────────────────────── Browser (React SPA) ───────────────────────────┐
│  Dashboard · Events · Prognosen · Statistik · Setup                       │
│                                                                           │
│  store.jsx        Zustand + localStorage-Persistenz (write-once-Prognosen)│
│  lib/quotes.js    Yahoo-Finance-Chart-API (Kurse + Historie)              │
│  lib/ai.js        Claude API (@anthropic-ai/sdk, Structured Output)       │
│  lib/evaluate.js  Auswertung fälliger Prognosen inkl. Benchmark/Alpha     │
│  lib/stats.js     Trefferquote, Ø Rendite, Kalibrierung, Zeitreihen       │
└───────────┬──────────────────────────────┬────────────────────────────────┘
            │                              │
   Vite-Proxy „/yahoo“            direkt (CORS erlaubt)
            │                              │
┌───────────▼───────────┐      ┌───────────▼───────────┐
│ Yahoo Finance v8      │      │ Claude API            │
│ /v8/finance/chart/…   │      │ api.anthropic.com     │
│ (kostenlos, ohne Key) │      │ (eigener API-Key)     │
└───────────────────────┘      └───────────────────────┘
```

## Datenquellen (kostenlos)

### Börsenkurse: Yahoo Finance Chart-API (gewählt)
- `GET /v8/finance/chart/{symbol}?range=1mo&interval=1d` bzw. `period1/period2`
- Kostenlos, **kein API-Key**, deckt US-Aktien, deutsche Aktien (`SAP.DE`,
  `SIE.DE` …) und Indizes (`^GSPC`, `^GDAXI`) ab; liefert Kurs, Vortagesschluss
  und Historie in einem Aufruf.
- Einschränkung: kein CORS für Browser → lokal übernimmt der **Vite-Proxy**
  (`/yahoo` → `query1.finance.yahoo.com`, siehe `vite.config.js`); bei
  statischem Hosting kann unter *Setup* ein eigener CORS-Proxy-Prefix
  hinterlegt werden (z. B. n8n-Webhook oder Cloudflare Worker). Inoffizielle
  API ohne SLA – für ein Beobachtungs-Tool ausreichend.

Geprüfte Alternativen:
- **Alpha Vantage**: offiziell, aber nur noch 25 Requests/Tag gratis → zu wenig.
- **Finnhub** (60 Req/min gratis, CORS ok): nur US-Aktien im Gratis-Tarif, kein DAX.
- **Twelve Data** (800 Req/Tag, CORS ok): guter Fallback, benötigt API-Key.
- **Stooq CSV**: kostenlos, aber ebenfalls ohne CORS und ohne Intraday-Meta.

### News/Events: manuelle Erfassung + KI-Analyse (gewählt)
Kostenlose News-APIs sind stark limitiert (NewsAPI: kein Produktivbetrieb
gratis; GDELT/RSS: ohne CORS, hoher Filteraufwand). Da die Bewertung ohnehin
ein bewusst gewähltes Event braucht, werden Events **manuell erfasst** (Titel,
Datum, Kategorie, Quelle, Beschreibung) und die **KI liefert die Analyse** dazu.
Erweiterung um einen RSS-Import über den Proxy ist vorgesehen.

### KI-Prognosen: Claude API
- Modell `claude-opus-4-8`, adaptives Thinking, **Structured Output**
  (JSON-Schema) → garantiert maschinenlesbare Prognosen:
  `{symbol, name, richtung (kauf/verkauf/halten), begruendung, horizontTage (1/7/30/90), konfidenz (0–100)}`
- Aufruf direkt aus dem Browser (`dangerouslyAllowBrowser`); der Key wird nur
  lokal gespeichert und ist nicht Teil des Daten-Exports. Für ein privates
  Einzelnutzer-Tool in Ordnung – nicht für öffentliche Deployments mit fremden
  Nutzern geeignet (dann Key hinter einen kleinen Server/Worker legen).

## Datenmodell (localStorage, Schlüssel `boersenradar.state.v1`)

```js
{
  settings:  { benchmarkSymbol: '^GSPC', proxyPrefix: '' },
  watchlist: ['^GSPC', '^GDAXI', ...],
  events:    [{ id, title, date, category, source, description, aiSummary, createdAt }],
  forecasts: [{
    id, eventId, symbol, name, direction, reasoning, horizonDays,
    confidence, origin: 'ki'|'manuell',
    createdAt, dueAt,                       // Zeitstempel, dueAt = createdAt + Horizont
    entryPrice, benchmarkSymbol, entryBenchmark,  // beim Anlegen eingefroren
    status: 'offen'|'richtig'|'falsch',
    result: { evaluatedAt, exitPrice, returnPct, directionalReturnPct,
              benchmarkReturnPct, alphaPct, verdict } | null,
    hash                                    // SHA-256 der eingefrorenen Felder
  }],
  quotes:    { [symbol]: { price, changePct, spark, currency, name, ts } }  // Cache
}
```

**Unveränderbarkeit der Prognosen:** Prognosen sind write-once – es gibt keine
Bearbeiten-Funktion, nur das Anhängen des Auswertungsergebnisses. Zusätzlich
wird beim Anlegen ein SHA-256-Hash über alle inhaltlichen Felder gespeichert
(„Integrität prüfen“ in der Prognose-Ansicht deckt nachträgliche Änderungen,
z. B. direkt im localStorage, auf).

## Bewertungslogik (`lib/evaluate.js`)

- Ausgewertet wird nach Ablauf des Zeithorizonts (`dueAt`), per Klick auf
  „Fällige auswerten“ (holt Historie via `period1/period2`).
- Einstieg = beim Anlegen eingefrorener Live-Kurs (Fallback: erster Schlusskurs
  nach `createdAt`), Ausstieg = letzter Schlusskurs bis `dueAt`.
- **Richtig**: Kauf → Rendite > 0 · Verkauf → Rendite < 0 · Halten → |Rendite| ≤ 2 %.
- **Direktionale Rendite**: Kauf +r, Verkauf −r (Short), Halten neutral.
- **Alpha** = direktionale Rendite − Benchmark-Rendite im selben Zeitraum
  (Benchmark wählbar: S&P 500, DAX, Nasdaq 100, Euro Stoxx 50).

## Statistik (`lib/stats.js` / Ansicht „Statistik“)

Trefferquote gesamt & letzte 30 Tage, Ø Rendite je Empfehlung, Ø Alpha,
kumulierte Rendite vs. Benchmark als Zeitreihe, Aufschlüsselung nach Kategorie /
Horizont / Richtung / KI-vs-manuell sowie **Kalibrierungs-Check** (Trefferquote
je Konfidenz-Bucket) – die Grundlage für die Frage „Ist die KI verlässlich
genug?“. Faustregel: erst ab ~30 abgeschlossenen Prognosen aussagekräftig.

## Grenzen / bewusste Vereinfachungen

- Kein automatischer Hintergrund-Job: Auswertung/Aktualisierung passiert beim
  Öffnen der App bzw. per Klick (frontend-only, kein Server).
- Yahoo-API ist inoffiziell; bei Ausfall lässt sich in `lib/quotes.js` ein
  anderer Provider (z. B. Twelve Data) ergänzen, der Rest bleibt unverändert.
- Keine Berücksichtigung von Dividenden, Splits (Yahoo liefert bereinigte
  Kurse), Spreads oder Gebühren – für Richtungs-Trefferquoten unerheblich.
- Daten liegen nur im Browser → regelmäßig JSON-Export nutzen.
