const ANALYSIS_PROMPT = `Analysiere dieses Bauangebot und extrahiere alle relevanten Informationen.
Gib NUR ein JSON-Objekt zurück, ohne Markdown-Code-Blöcke, Erklärungen oder zusätzlichen Text.
Fehlende Felder mit null belegen.

{
  "company": "Firmenname",
  "address": "Vollständige Firmenadresse",
  "contactPerson": "Ansprechpartner",
  "phone": "Telefon",
  "email": "E-Mail",
  "offerDate": "YYYY-MM-DD",
  "validUntil": "YYYY-MM-DD",
  "totalNet": 0,
  "totalGross": 0,
  "taxRate": 19,
  "currency": "EUR",
  "paymentTerms": "Zahlungsbedingungen",
  "items": [
    {
      "position": "1",
      "description": "Leistungsbeschreibung",
      "quantity": 0,
      "unit": "Einheit",
      "unitPrice": 0,
      "total": 0
    }
  ],
  "notes": "Sonstige Hinweise"
}`;

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const analyzeDocument = async (file, apiKey) => {
  const base64 = await fileToBase64(file);
  const isPdf = file.type === 'application/pdf';

  const contentBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [contentBlock, { type: 'text', text: ANALYSIS_PROMPT }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API-Fehler: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0]?.text ?? '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('KI konnte keine strukturierten Daten aus dem Dokument extrahieren.');

  return JSON.parse(jsonMatch[0]);
};
