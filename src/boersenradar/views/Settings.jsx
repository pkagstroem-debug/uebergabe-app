// Einstellungen: Claude-API-Key, Benchmark, Kurs-Proxy, Export/Import

import React, { useRef, useState } from 'react';
import { useStore, getApiKey, setApiKey, exportStateJson } from '../store';
import { BENCHMARKS } from '../lib/util';
import { Card, SectionTitle, Button, Input, Select, Label } from '../components/ui';

export default function Settings() {
  const { state, dispatch } = useStore();
  const [apiKey, setApiKeyLocal] = useState(getApiKey());
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);

  const save = () => {
    setApiKey(apiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const importFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.forecasts)) {
          throw new Error('Format nicht erkannt');
        }
        dispatch({ type: 'IMPORT_STATE', state: parsed });
      } catch (err) {
        alert(`Import fehlgeschlagen: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="grid gap-4">
      <Card>
        <SectionTitle>Claude API (für KI-Prognosen)</SectionTitle>
        <Label>API-Key (bleibt nur lokal in diesem Browser gespeichert)</Label>
        <div className="flex gap-2">
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKeyLocal(e.target.value)}
            placeholder="sk-ant-…"
            autoComplete="off"
          />
          <Button onClick={save}>{saved ? '✓ Gespeichert' : 'Speichern'}</Button>
        </div>
        <p className="text-xs text-[#898781] mt-2">
          Einen Key erhältst du unter platform.claude.com. Der Key wird ausschließlich lokal gespeichert und direkt an
          die Claude API gesendet – er ist nicht Teil des Daten-Exports.
        </p>
      </Card>

      <Card>
        <SectionTitle>Bewertung</SectionTitle>
        <Label>Benchmark für den Marktvergleich</Label>
        <Select
          value={state.settings.benchmarkSymbol}
          onChange={(e) => dispatch({ type: 'SET_SETTINGS', settings: { benchmarkSymbol: e.target.value } })}
        >
          {BENCHMARKS.map((b) => (
            <option key={b.symbol} value={b.symbol}>
              {b.label} ({b.symbol})
            </option>
          ))}
        </Select>
        <p className="text-xs text-[#898781] mt-2">
          Gilt für neue Prognosen; bestehende behalten die beim Anlegen eingefrorene Benchmark. Bewertungsregel: Kauf
          ist richtig bei steigendem Kurs, Verkauf bei fallendem, Halten bei ±2 % Seitwärtsbewegung – jeweils zum Ende
          des Zeithorizonts.
        </p>
      </Card>

      <Card>
        <SectionTitle>Kursdaten (Yahoo Finance)</SectionTitle>
        <Label>Optionaler CORS-Proxy-Prefix (nur nötig bei statischem Hosting ohne Vite-Proxy)</Label>
        <Input
          value={state.settings.proxyPrefix}
          onChange={(e) => dispatch({ type: 'SET_SETTINGS', settings: { proxyPrefix: e.target.value } })}
          placeholder="z. B. https://mein-proxy.example.com/yahoo"
        />
        <p className="text-xs text-[#898781] mt-2">
          Leer lassen, wenn die App lokal mit „npm run dev“ läuft – dann übernimmt der eingebaute Proxy. Der Prefix
          wird vor Pfade wie /v8/finance/chart/… gesetzt.
        </p>
      </Card>

      <Card>
        <SectionTitle>Daten</SectionTitle>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => exportStateJson(state)}>
            ⬇ Export (JSON)
          </Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            ⬆ Import
          </Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importFile} />
        </div>
        <p className="text-xs text-[#898781] mt-2">
          Alle Daten liegen nur im localStorage dieses Browsers. Regelmäßiger Export empfohlen. Import ersetzt den
          kompletten Datenbestand.
        </p>
      </Card>
    </div>
  );
}
