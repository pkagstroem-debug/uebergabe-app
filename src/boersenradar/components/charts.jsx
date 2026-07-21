// Kleine SVG-Charts (Dark Theme). Farbrollen:
// Serie 1 Blau #3987e5, Serie 2 Orange #d95926 (validierte Dark-Palette),
// Status: gut #0ca30c / kritisch #d03b3b. Text trägt nie Serienfarbe.

import React, { useState } from 'react';
import { fmtPct } from '../lib/util';

export const C = {
  series1: '#3987e5',
  series2: '#d95926',
  good: '#0ca30c',
  critical: '#d03b3b',
  warning: '#c98500',
  ink: '#ffffff',
  ink2: '#c3c2b7',
  muted: '#898781',
  grid: '#2c2c2a',
  baseline: '#383835',
  surface: '#1a1a19',
};

// --- Sparkline (eine Serie, keine Legende – der Kontext benennt sie) ---
export function Sparkline({ data, width = 96, height = 28 }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * (width - 4) + 2,
    height - 3 - ((v - min) / span) * (height - 6),
  ]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const up = data[data.length - 1] >= data[0];
  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={d} fill="none" stroke={up ? C.good : C.critical} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// --- Horizontale Balken: Trefferquote je Gruppe (eine Serie, direkte Labels) ---
export function HitRateBars({ rows, valueKey = 'hitRate', suffix = ' %' }) {
  if (!rows?.length) return null;
  const barH = 22;
  const gap = 10;
  const labelW = 110;
  const valueW = 88;
  const chartW = 320;
  const height = rows.length * (barH + gap);
  return (
    <svg
      viewBox={`0 0 ${labelW + chartW + valueW} ${height}`}
      className="w-full"
      style={{ maxWidth: 560 }}
      role="img"
      aria-label="Trefferquote als Balkendiagramm"
    >
      {rows.map((r, i) => {
        const y = i * (barH + gap);
        const w = Math.max(2, (Math.min(100, r[valueKey] ?? 0) / 100) * chartW);
        return (
          <g key={r.key}>
            <text x={labelW - 8} y={y + barH / 2 + 4} textAnchor="end" fontSize="12" fill={C.ink2}>
              {r.key}
            </text>
            <line x1={labelW} y1={y} x2={labelW} y2={y + barH} stroke={C.baseline} strokeWidth="1" />
            <rect x={labelW} y={y} width={w} height={barH} rx="4" fill={C.series1}>
              <title>{`${r.key}: ${r.hits}/${r.total} richtig`}</title>
            </rect>
            <text x={labelW + chartW + 8} y={y + barH / 2 + 4} fontSize="12" fill={C.ink}>
              {r[valueKey] != null ? `${Math.round(r[valueKey])}${suffix}` : '–'}
              <tspan fill={C.muted}>{`  (${r.hits}/${r.total})`}</tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// --- Linienchart: kumulierte Rendite Empfehlungen vs. Benchmark (2 Serien) ---
export function CumulativeChart({ series, benchmarkName }) {
  const [hover, setHover] = useState(null);
  if (!series || series.length < 2) return null;

  const W = 560;
  const H = 220;
  const pad = { l: 44, r: 96, t: 12, b: 24 };
  const values = series.flatMap((p) => [p.cum, p.cumBench]);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const x = (i) => pad.l + (i / (series.length - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - min) / span) * (H - pad.t - pad.b);
  const path = (key) => series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');

  const ticks = [min, min + span / 2, max];
  const last = series[series.length - 1];

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (series.length - 1));
    setHover(Math.max(0, Math.min(series.length - 1, i)));
  };

  return (
    <div>
      <div className="flex gap-4 mb-1 text-xs" style={{ color: C.ink2 }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: C.series1 }} /> Empfehlungen
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: C.series2 }} /> {benchmarkName}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        style={{ maxWidth: 640 }}
        role="img"
        aria-label="Kumulierte Rendite der Empfehlungen im Vergleich zur Benchmark"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} y1={y(t)} x2={W - pad.r} y2={y(t)} stroke={C.grid} strokeWidth="1" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill={C.muted}>
              {`${t > 0 ? '+' : ''}${t.toFixed(0)} %`}
            </text>
          </g>
        ))}
        <line x1={pad.l} y1={y(0)} x2={W - pad.r} y2={y(0)} stroke={C.baseline} strokeWidth="1" />
        <path d={path('cumBench')} fill="none" stroke={C.series2} strokeWidth="2" strokeLinejoin="round" />
        <path d={path('cum')} fill="none" stroke={C.series1} strokeWidth="2" strokeLinejoin="round" />
        {/* Direkte Labels am Linienende */}
        <text x={W - pad.r + 6} y={y(last.cum) + 4} fontSize="11" fill={C.ink}>
          {fmtPct(last.cum)}
        </text>
        <text x={W - pad.r + 6} y={y(last.cumBench) + (Math.abs(y(last.cum) - y(last.cumBench)) < 12 ? 16 : 4)} fontSize="11" fill={C.ink2}>
          {fmtPct(last.cumBench)}
        </text>
        {hover != null && (
          <g>
            <line x1={x(hover)} y1={pad.t} x2={x(hover)} y2={H - pad.b} stroke={C.muted} strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(series[hover].cum)} r="4" fill={C.series1} stroke={C.surface} strokeWidth="2" />
            <circle cx={x(hover)} cy={y(series[hover].cumBench)} r="4" fill={C.series2} stroke={C.surface} strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="text-xs mt-1" style={{ color: C.ink2 }}>
          Nach „{series[hover].label}“: Empfehlungen {fmtPct(series[hover].cum)} · {benchmarkName}{' '}
          {fmtPct(series[hover].cumBench)}
        </div>
      )}
    </div>
  );
}

// --- Stat-Kachel ---
export function StatTile({ label, value, sub, tone }) {
  const toneColor = tone === 'good' ? C.good : tone === 'bad' ? C.critical : C.ink;
  return (
    <div className="rounded-xl p-4" style={{ background: C.surface, border: '1px solid rgba(255,255,255,0.10)' }}>
      <div className="text-xs mb-1" style={{ color: C.muted }}>
        {label}
      </div>
      <div className="text-2xl font-semibold" style={{ color: toneColor }}>
        {value}
      </div>
      {sub && (
        <div className="text-xs mt-1" style={{ color: C.ink2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
