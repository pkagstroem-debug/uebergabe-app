// Zentraler Zustand mit localStorage-Persistenz.
// Prognosen sind nach dem Anlegen unveränderlich (write-once); es gibt bewusst
// keine Edit-Aktionen – nur das Anhängen von Auswertungsergebnissen.

import React, { createContext, useContext, useEffect, useReducer } from 'react';

const STORAGE_KEY = 'boersenradar.state.v1';
const API_KEY_STORAGE = 'boersenradar.apiKey'; // getrennt, damit Export/Import keinen Key enthält

export const initialState = {
  version: 1,
  settings: {
    proxyPrefix: '',
    benchmarkSymbol: '^GSPC',
  },
  watchlist: ['^GSPC', '^GDAXI'],
  events: [], // {id, title, date, category, source, description, aiSummary, createdAt}
  forecasts: [], // siehe views/Events.jsx -> buildForecast()
  quotes: {}, // Cache: {symbol: {price, changePct, spark, ...}}
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw);
    return {
      ...initialState,
      ...parsed,
      settings: { ...initialState.settings, ...parsed.settings },
    };
  } catch {
    return initialState;
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_EVENT':
      return { ...state, events: [action.event, ...state.events] };
    case 'DELETE_EVENT': {
      // Event löschen ist erlaubt, zugehörige Prognosen bleiben als Historie bestehen
      return { ...state, events: state.events.filter((e) => e.id !== action.id) };
    }
    case 'SET_EVENT_AI_SUMMARY':
      return {
        ...state,
        events: state.events.map((e) => (e.id === action.id ? { ...e, aiSummary: action.summary } : e)),
      };
    case 'ADD_FORECASTS':
      return { ...state, forecasts: [...action.forecasts, ...state.forecasts] };
    case 'APPLY_RESULTS': {
      // Auswertung anhängen – die ursprünglichen Prognose-Felder bleiben unangetastet
      const results = action.results;
      return {
        ...state,
        forecasts: state.forecasts.map((f) =>
          results[f.id] ? { ...f, status: results[f.id].verdict, result: results[f.id] } : f
        ),
      };
    }
    case 'ADD_WATCH':
      if (state.watchlist.includes(action.symbol)) return state;
      return { ...state, watchlist: [...state.watchlist, action.symbol] };
    case 'REMOVE_WATCH':
      return { ...state, watchlist: state.watchlist.filter((s) => s !== action.symbol) };
    case 'SET_QUOTES':
      return { ...state, quotes: { ...state.quotes, ...action.quotes } };
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'IMPORT_STATE':
      return { ...initialState, ...action.state, settings: { ...initialState.settings, ...action.state.settings } };
    default:
      return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Persistenz fehlgeschlagen', e);
    }
  }, [state]);

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export const useStore = () => useContext(StoreContext);

export const getApiKey = () => localStorage.getItem(API_KEY_STORAGE) ?? '';
export const setApiKey = (key) => {
  if (key) localStorage.setItem(API_KEY_STORAGE, key);
  else localStorage.removeItem(API_KEY_STORAGE);
};

export function exportStateJson(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `boersenradar-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
