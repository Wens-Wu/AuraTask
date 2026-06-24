import type { Habit, HabitLog, HabitSchedule } from "../types";
import { addDays, startOfWeek, toISODate } from "./date";

export const isCompleted = (habit: Habit, value: number): boolean => {
  if (habit.kind === "binary") return value >= 1;
  if (habit.target_value == null) return value > 0;
  return value >= habit.target_value;
};

// ── Schedule encoding ────────────────────────────────────────────────────────
// "daily" | "days:1,3,5" (ISO weekdays Mon=1..Sun=7) | "weekly:N"

export const parseSchedule = (raw: string | null | undefined): HabitSchedule => {
  if (!raw || raw === "daily") return { kind: "daily" };
  if (raw.startsWith("days:")) {
    const days = raw
      .slice(5)
      .split(",")
      .map(Number)
      .filter((n) => n >= 1 && n <= 7);
    return days.length ? { kind: "days", days: [...new Set(days)].sort() } : { kind: "daily" };
  }
  if (raw.startsWith("weekly:")) {
    const count = Math.max(1, Math.round(Number(raw.slice(7)) || 1));
    return { kind: "weekly", count };
  }
  return { kind: "daily" };
};

export const serializeSchedule = (s: HabitSchedule): string => {
  if (s.kind === "days") {
    const days = [...new Set(s.days)].filter((n) => n >= 1 && n <= 7).sort();
    return days.length ? `days:${days.join(",")}` : "daily";
  }
  if (s.kind === "weekly") return `weekly:${Math.max(1, Math.round(s.count))}`;
  return "daily";
};

/** ISO weekday for a date: Mon=1 … Sun=7. */
export const isoWeekday = (d: Date): number => ((d.getDay() + 6) % 7) + 1;

/** Whether the habit is "due" on a given weekday. Weekly habits float across
 *  the week, so they're available (due) on any day until the week's quota is met. */
export const isScheduledWeekday = (s: HabitSchedule, isoWd: number): boolean =>
  s.kind === "days" ? s.days.includes(isoWd) : true;

const WEEKDAY_ZH = ["一", "二", "三", "四", "五", "六", "日"];
const WEEKDAY_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Short human label for the schedule, e.g. "每天" / "周一·三·五" / "每周 2 次". */
export const scheduleSummary = (s: HabitSchedule, lang: "zh" | "en" = "zh"): string => {
  if (s.kind === "daily") return lang === "zh" ? "每天" : "Daily";
  if (s.kind === "weekly") {
    return lang === "zh" ? `每周 ${s.count} 次` : `${s.count}× / week`;
  }
  const days = [...s.days].sort();
  if (lang === "zh") return "周" + days.map((d) => WEEKDAY_ZH[d - 1]).join("·");
  return days.map((d) => WEEKDAY_EN[d - 1]).join("·");
};

/** Streak is counted in days for daily/weekday habits, but in weeks for weekly-N. */
export const streakUnit = (s: HabitSchedule): "day" | "week" =>
  s.kind === "weekly" ? "week" : "day";

const countCompletedInWeek = (
  habit: Habit,
  logsByDate: Map<string, number>,
  weekStart: Date,
): number => {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const v = logsByDate.get(toISODate(addDays(weekStart, i)));
    if (v !== undefined && isCompleted(habit, v)) n++;
  }
  return n;
};

/**
 * Consecutive completions counted backwards from today, respecting the schedule:
 * - daily / specific-weekday habits → consecutive scheduled DAYS completed
 *   (non-scheduled days are skipped, they neither extend nor break the streak;
 *    today not yet logged is lenient and doesn't break it).
 * - weekly-N habits → consecutive WEEKS that hit the quota (the current,
 *   unfinished week is lenient: it extends the streak once met, never breaks it).
 */
export const computeStreak = (
  habit: Habit,
  logsByDate: Map<string, number>,
  today: Date = new Date(),
): number => {
  const sched = parseSchedule(habit.schedule);

  if (sched.kind === "weekly") {
    let streak = 0;
    let weekStart = startOfWeek(today);
    let first = true;
    for (let guard = 0; guard < 520; guard++) {
      const met = countCompletedInWeek(habit, logsByDate, weekStart) >= sched.count;
      if (met) streak++;
      else if (!first) break; // a past week missed the quota → streak ends
      first = false;
      weekStart = addDays(weekStart, -7);
    }
    return streak;
  }

  const todayISO = toISODate(today);
  let streak = 0;
  let cursor = today;
  for (let guard = 0; guard < 3650; guard++) {
    if (isScheduledWeekday(sched, isoWeekday(cursor))) {
      const iso = toISODate(cursor);
      const v = logsByDate.get(iso);
      if (v !== undefined && isCompleted(habit, v)) streak++;
      else if (iso !== todayISO) break; // today unlogged is lenient; a past gap breaks it
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
};

/**
 * Completion rate over [startISO, endISO], measured only against days the habit
 * was actually scheduled (so resting days don't drag the percentage down).
 * Weekly-N habits are scored per week: each week expects N completions.
 */
export const completionRate = (
  habit: Habit,
  logs: HabitLog[],
  startISO: string,
  endISO: string,
): number => {
  if (startISO > endISO) return 0;
  const sched = parseSchedule(habit.schedule);
  const done = new Set<string>();
  for (const l of logs) if (isCompleted(habit, l.value)) done.add(l.date);

  const [sy, sm, sd] = startISO.split("-").map(Number);
  const [ey, em, ed] = endISO.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  if (sched.kind === "weekly") {
    const perWeek = new Map<string, number>();
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const wk = toISODate(startOfWeek(d));
      const cur = perWeek.get(wk) ?? 0;
      perWeek.set(wk, cur + (done.has(toISODate(d)) ? 1 : 0));
    }
    const expected = perWeek.size * sched.count;
    let achieved = 0;
    for (const c of perWeek.values()) achieved += Math.min(c, sched.count);
    return expected ? Math.min(100, Math.round((achieved / expected) * 100)) : 0;
  }

  let expected = 0;
  let achieved = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (!isScheduledWeekday(sched, isoWeekday(d))) continue;
    expected++;
    if (done.has(toISODate(d))) achieved++;
  }
  return expected ? Math.min(100, Math.round((achieved / expected) * 100)) : 0;
};
