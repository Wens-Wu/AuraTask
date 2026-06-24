import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { logicalDateISO, toISODate } from "../utils/date";
import { clampDayStart, getDayStartHour, setDayStartHourRaw } from "../utils/settings";

interface SettingsCtx {
  /** Hour (0–6) at which a new logical day begins. */
  dayStartHour: number;
  setDayStartHour: (h: number) => void;
  /** Calendar-date string the current moment belongs to. */
  todayISO: string;
  /** Whether a calendar-date `Date` (a cell / due_date) is the logical today. */
  isToday: (d: Date) => boolean;
}

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [dayStartHour, setHour] = useState<number>(() => getDayStartHour());

  const setDayStartHour = useCallback((h: number) => {
    const v = clampDayStart(h);
    setDayStartHourRaw(v);
    setHour(v);
  }, []);

  const value = useMemo<SettingsCtx>(() => {
    const todayISO = logicalDateISO(new Date(), dayStartHour);
    return {
      dayStartHour,
      setDayStartHour,
      todayISO,
      isToday: (d: Date) => toISODate(d) === todayISO,
    };
  }, [dayStartHour, setDayStartHour]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
