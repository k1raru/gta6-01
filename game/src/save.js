// Save / load through localStorage. Progress is cash, missions and stats.
const KEY = 'solmar-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    const data = {
      cash: state.cash,
      missionsDone: state.missionsDone,
      totalEarned: state.totalEarned,
      carsStolen: state.carsStolen,
      faresDone: state.faresDone,
      bestWanted: state.bestWanted,
      muted: state.muted,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable (private mode, etc.) — the game still plays.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
