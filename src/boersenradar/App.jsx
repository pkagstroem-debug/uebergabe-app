// KI-Börsenradar – Prognose-Tracker (Paper-Trading, kein echter Handel)

import React, { useState } from 'react';
import { StoreProvider } from './store';
import Dashboard from './views/Dashboard';
import Events from './views/Events';
import Forecasts from './views/Forecasts';
import Stats from './views/Stats';
import Settings from './views/Settings';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'events', label: 'Events', icon: '📰' },
  { id: 'prognosen', label: 'Prognosen', icon: '🎯' },
  { id: 'statistik', label: 'Statistik', icon: '📈' },
  { id: 'einstellungen', label: 'Setup', icon: '⚙️' },
];

function Disclaimer() {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      onClick={() => setExpanded((e) => !e)}
      className="w-full text-left rounded-xl border border-[#c98500]/40 bg-[#c98500]/10 px-3 py-2 text-xs text-[#c3c2b7]"
    >
      ⚠️ <span className="font-medium text-white">Keine Anlageberatung.</span> Reines Beobachtungs- und
      Simulationswerkzeug (Paper-Trading){expanded ? ':' : ' – mehr erfahren'}
      {expanded && (
        <span className="block mt-1">
          Alle Prognosen sind automatisch generierte, experimentelle Einschätzungen einer KI und können falsch sein.
          Es wird kein echtes Geld gehandelt. Die Inhalte stellen keine Anlage-, Rechts- oder Steuerberatung und keine
          Kauf- oder Verkaufsempfehlung dar. Kapitalanlagen sind mit erheblichen Risiken bis hin zum Totalverlust
          verbunden. Triff Anlageentscheidungen nie allein auf Basis dieser App.
        </span>
      )}
    </button>
  );
}

function Shell() {
  const [tab, setTab] = useState('dashboard');

  const view = {
    dashboard: <Dashboard onNavigate={setTab} />,
    events: <Events />,
    prognosen: <Forecasts />,
    statistik: <Stats />,
    einstellungen: <Settings />,
  }[tab];

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
      <div className="max-w-3xl mx-auto px-3 pt-4 pb-24 sm:pb-8">
        <header className="mb-3">
          <div className="flex items-baseline justify-between">
            <h1 className="text-lg font-bold">
              📡 KI-Börsenradar
              <span className="ml-2 text-xs font-normal text-[#898781]">Prognose-Tracker · Paper-Trading</span>
            </h1>
            <a href="#/uebergabe" className="text-xs text-[#898781] hover:text-white">
              Übergabe-App →
            </a>
          </div>
          <div className="mt-2">
            <Disclaimer />
          </div>
        </header>

        {/* Desktop-Tabs */}
        <nav className="hidden sm:flex gap-1 mb-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                tab === t.id ? 'bg-[#3987e5] text-white' : 'text-[#c3c2b7] hover:bg-white/5'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </nav>

        <main>{view}</main>
      </div>

      {/* Mobile: Bottom-Navigation */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-[#1a1a19] border-t border-white/10 flex">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-center text-[11px] ${tab === t.id ? 'text-[#3987e5]' : 'text-[#898781]'}`}
          >
            <div className="text-base leading-tight">{t.icon}</div>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function BoersenradarApp() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
