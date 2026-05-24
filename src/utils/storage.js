import { initialProjects, initialGewerke, initialAngebote } from '../data/sampleData.js';

const DATA_KEY = 'bautrack_data';
const API_KEY_STORAGE = 'bautrack_api_key';

const defaultData = () => ({
  projects: initialProjects,
  gewerke: initialGewerke,
  angebote: initialAngebote,
});

export const loadData = () => {
  try {
    const stored = localStorage.getItem(DATA_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore parse errors
  }
  return defaultData();
};

export const saveData = (data) => {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
};

export const loadApiKey = () => {
  try {
    return localStorage.getItem(API_KEY_STORAGE) || '';
  } catch {
    return '';
  }
};

export const saveApiKey = (key) => {
  try {
    localStorage.setItem(API_KEY_STORAGE, key);
  } catch {
    // ignore
  }
};

export const genId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
