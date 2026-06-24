// Pure (non-React) accessors for app preferences kept in localStorage, so
// modules that can't use React hooks (e.g. db/database.ts) share one source of
// truth with the SettingsProvider context.

export const DAY_START_KEY = "auratask.dayStartHour";
export const DAY_START_MIN = 0;
export const DAY_START_MAX = 6;

export const clampDayStart = (n: number): number =>
  Math.max(DAY_START_MIN, Math.min(DAY_START_MAX, Math.trunc(n)));

export const getDayStartHour = (): number => {
  try {
    const raw = localStorage.getItem(DAY_START_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? clampDayStart(n) : 0;
  } catch {
    return 0;
  }
};

export const setDayStartHourRaw = (h: number): void => {
  localStorage.setItem(DAY_START_KEY, String(clampDayStart(h)));
};
