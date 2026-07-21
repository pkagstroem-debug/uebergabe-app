// KI-Prognosen über die Claude API (Anthropic SDK, direkt aus dem Browser).
//
// Der API-Key wird nur lokal im Browser gespeichert (Einstellungen) und mit
// `dangerouslyAllowBrowser` direkt an api.anthropic.com gesendet – für ein
// privates Einzelnutzer-Tool in Ordnung; niemals in einer öffentlichen Seite
// mit fremden Nutzern einsetzen.

import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-4-8';

// Strukturierte Ausgabe: erzwingt valides JSON in genau dieser Form.
const FORECAST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['einschaetzung', 'prognosen'],
  properties: {
    einschaetzung: {
      type: 'string',
      description: 'Kurze Gesamteinschätzung des Events und seiner Marktwirkung (2-4 Sätze, Deutsch).',
    },
    prognosen: {
      type: 'array',
      description: 'Konkrete Einzelprognosen für betroffene Aktien/Indizes (1-5 Stück).',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['symbol', 'name', 'richtung', 'begruendung', 'horizontTage', 'konfidenz'],
        properties: {
          symbol: {
            type: 'string',
            description:
              'Yahoo-Finance-Ticker, z. B. AAPL, MSFT, SAP.DE, SIE.DE, RHM.DE, ^GDAXI. Deutsche Aktien mit .DE-Suffix.',
          },
          name: { type: 'string', description: 'Name des Unternehmens/Index.' },
          richtung: { type: 'string', enum: ['kauf', 'verkauf', 'halten'] },
          begruendung: {
            type: 'string',
            description: 'Nachvollziehbare Begründung auf Deutsch: Wirkungskette vom Event zum Kurs.',
          },
          horizontTage: {
            type: 'integer',
            description: 'Zeithorizont in Tagen: exakt einer der Werte 1, 7, 30 oder 90.',
          },
          konfidenz: {
            type: 'integer',
            description: 'Konfidenz 0-100 (%). Ehrlich kalibrieren, 50 = Münzwurf.',
          },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `Du bist ein nüchterner Finanzmarkt-Analyst in einem Paper-Trading-Experiment.
Der Nutzer erfasst reale Ereignisse (Zinsentscheide, Wahlen, Quartalszahlen, Regulierung, Geopolitik)
und du gibst dazu überprüfbare Aktien-Prognosen ab, deren Trefferquote später gemessen wird.

Regeln:
- Wähle 1 bis 5 konkrete, liquide Aktien oder Indizes, die von dem Event am stärksten betroffen sind.
- Verwende ausschließlich gültige Yahoo-Finance-Ticker (US: AAPL, MSFT ...; Deutschland: SAP.DE, SIE.DE, RHM.DE ...; Indizes: ^GDAXI, ^GSPC).
- Richtung "kauf" = Kurs steigt voraussichtlich, "verkauf" = fällt, "halten" = weitgehend seitwärts (±2 %).
- Wähle den Zeithorizont (1, 7, 30 oder 90 Tage) passend zur erwarteten Wirkungsdauer des Events.
- Kalibriere die Konfidenz ehrlich: 50 heißt Münzwurf, über 80 nur bei sehr klarer Wirkungskette.
- Begründe knapp, aber mit konkreter Wirkungskette (Event -> Mechanismus -> Kurswirkung).
- Beachte: Märkte preisen erwartete Ereignisse oft schon vorher ein ("buy the rumor, sell the news").
- Dies ist keine Anlageberatung, sondern ein Prognose-Experiment ohne echtes Geld.`;

export async function generateForecasts(apiKey, event) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const userMessage = `Ereignis vom ${event.date}:
Titel: ${event.title}
Kategorie: ${event.category}
Quelle: ${event.source || 'nicht angegeben'}
Beschreibung: ${event.description || '(keine weitere Beschreibung)'}

Heutiges Datum: ${new Date().toISOString().slice(0, 10)}.
Erstelle deine Einschätzung und die Einzelprognosen.`;

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema: FORECAST_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new Error('API-Key ungültig – bitte in den Einstellungen prüfen.');
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new Error('Rate-Limit der Claude API erreicht – bitte kurz warten und erneut versuchen.');
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new Error('Keine Verbindung zur Claude API (Netzwerk/CORS).');
    }
    if (error instanceof Anthropic.APIError) {
      throw new Error(`Claude API Fehler ${error.status ?? ''}: ${error.message}`);
    }
    throw error;
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('Die KI hat die Anfrage abgelehnt.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('Antwort unvollständig (Token-Limit) – bitte erneut versuchen.');
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('Leere Antwort der Claude API.');

  const parsed = JSON.parse(textBlock.text);

  // Client-seitige Plausibilisierung (JSON-Schema kann keine Wertebereiche erzwingen)
  const allowedHorizons = [1, 7, 30, 90];
  parsed.prognosen = (parsed.prognosen ?? []).slice(0, 5).map((p) => ({
    ...p,
    symbol: String(p.symbol).trim().toUpperCase(),
    horizontTage: allowedHorizons.includes(p.horizontTage)
      ? p.horizontTage
      : allowedHorizons.reduce((a, b) => (Math.abs(b - p.horizontTage) < Math.abs(a - p.horizontTage) ? b : a)),
    konfidenz: Math.max(0, Math.min(100, Math.round(p.konfidenz))),
  }));

  return parsed;
}
