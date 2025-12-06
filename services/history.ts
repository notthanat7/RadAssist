import { SavedReport } from '../types';

const HISTORY_KEY = 'radassist_history';

export const getHistory = (): SavedReport[] => {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Failed to load history", e);
    return [];
  }
};

export const saveReportToHistory = (report: SavedReport) => {
  try {
    const current = getHistory();
    // Add to beginning, limit to last 50
    const updated = [report, ...current].slice(0, 50);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save report to history", e);
  }
};

export const deleteReportFromHistory = (id: string) => {
  try {
    const current = getHistory();
    const updated = current.filter(r => r.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to delete report from history", e);
  }
};

export const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
};