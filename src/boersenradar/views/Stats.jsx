// Statistik: Modell-Performance über die Zeit

import React from 'react';
import { useStore } from '../store';
import { computeStats, statsByKey, cumulativeSeries, calibration } from '../lib/stats';
import { fmtPct, horizonLabel, benchmarkLabel, DIRECTIONS } from '../lib/util';
import { Card, SectionTitle, EmptyHint } from '../components/ui';
import { StatTile, HitRateBars, CumulativeChart } from '../components/charts';

export default function Stats() {
  const { state } = useStore();
  const { forecasts, events, settings } = state;

  const overall = computeStats(forecasts);
  const last30 = computeStats(forecasts, { sinceDays: 30 });
  const series = cumulativeSeries(forecasts);

  if (overall.total === 0) {
    return (
      <EmptyHint>
        Noch keine abgeschlossenen Prognosen. Sobald Prognosen fällig und ausgewertet sind, erscheint hier die
        Performance-Statistik (Trefferquote, Rendite, Benchmark-Vergleich).
      </EmptyHint>
    );
  }

  const byCategory = statsByKey(forecasts, events, (f, e) => e?.category ?? 'ohne Event');
  const byHorizon = statsByKey(forecasts, events, (f) => horizonLabel(f.horizonDays));
  const byDirection = statsByKey(forecasts, events, (f) => DIRECTIONS[f.direction].label);
  const byOrigin = statsByKey(forecasts, events, (f) => (f.origin === 'ki' ? 'KI' : 'Manuell'));
  const calib = calibration(forecasts);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Trefferquote gesamt"
          value={overall.hitRate != null ? `${Math.round(overall.hitRate)} %` : '–'}
          sub={`${overall.hits} von ${overall.total} richtig`}
          tone={overall.hitRate >= 55 ? 'good' : overall.hitRate < 45 ? 'bad' : undefined}
        />
        <StatTile
          label="Trefferquote 30 Tage"
          value={last30.hitRate != null ? `${Math.round(last30.hitRate)} %` : '–'}
          sub={`${last30.hits} von ${last30.total} richtig`}
          tone={last30.hitRate >= 55 ? 'good' : last30.hitRate != null && last30.hitRate < 45 ? 'bad' : undefined}
        />
        <StatTile
          label="Ø Rendite je Empfehlung"
          value={fmtPct(overall.avgReturn)}
          sub="direktional (Kauf +, Verkauf −)"
          tone={overall.avgReturn > 0 ? 'good' : overall.avgReturn < 0 ? 'bad' : undefined}
        />
        <StatTile
          label={`Ø Alpha vs. ${benchmarkLabel(settings.benchmarkSymbol)}`}
          value={fmtPct(overall.avgAlpha)}
          sub="Mehrrendite ggü. Markt"
          tone={overall.avgAlpha > 0 ? 'good' : overall.avgAlpha < 0 ? 'bad' : undefined}
        />
      </div>

      {series.length >= 2 && (
        <Card>
          <SectionTitle>Kumulierte Rendite über die Zeit</SectionTitle>
          <CumulativeChart series={series} benchmarkName={benchmarkLabel(settings.benchmarkSymbol)} />
        </Card>
      )}

      <Card>
        <SectionTitle>Trefferquote nach Kategorie</SectionTitle>
        <HitRateBars rows={byCategory} />
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <SectionTitle>Nach Zeithorizont</SectionTitle>
          <HitRateBars rows={byHorizon} />
        </Card>
        <Card>
          <SectionTitle>Nach Richtung</SectionTitle>
          <HitRateBars rows={byDirection} />
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <SectionTitle>KI vs. manuelle Prognosen</SectionTitle>
          <HitRateBars rows={byOrigin} />
        </Card>
        {calib.length > 0 && (
          <Card>
            <SectionTitle>Kalibrierung (Trefferquote je Konfidenz)</SectionTitle>
            <HitRateBars rows={calib} />
            <p className="text-xs text-[#898781] mt-2">
              Gut kalibriert = hohe Konfidenz geht mit hoher Trefferquote einher. Weicht das stark ab, sind die
              Konfidenzwerte der KI wenig verlässlich.
            </p>
          </Card>
        )}
      </div>

      <p className="text-xs text-[#898781]">
        Interpretationshilfe: Eine Trefferquote um 50 % entspricht dem Zufall. Aussagekraft entsteht erst mit
        ausreichend vielen abgeschlossenen Prognosen (&gt; 30) und einem positiven Alpha gegenüber der Benchmark.
      </p>
    </div>
  );
}
