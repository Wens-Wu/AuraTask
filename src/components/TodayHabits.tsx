import { useEffect, useState } from "react";
import {
  clearHabitLog,
  listActiveHabits,
  listAllLogsInRange,
  upsertHabitLog,
} from "../db/database";
import type { Habit } from "../types";
import { isCompleted, isScheduledWeekday, isoWeekday, parseSchedule } from "../utils/habits";
import { addDays, fromISODate, startOfWeek, toISODate } from "../utils/date";
import { useT } from "../i18n";

interface Props {
  dateISO: string;
  isToday: boolean;
}

const COLLAPSE_KEY = "auratask.habits.collapsed";

// habit_id → (date → value), scoped to the week containing the viewed day.
type WeekLogs = Map<number, Map<string, number>>;

export default function TodayHabits({ dateISO, isToday }: Props) {
  const { t } = useT();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [weekLogs, setWeekLogs] = useState<WeekLogs>(new Map());
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1",
  );

  const refresh = async () => {
    const weekStart = startOfWeek(fromISODate(dateISO));
    const startISO = toISODate(weekStart);
    const endISO = toISODate(addDays(weekStart, 6));
    const [hs, ls] = await Promise.all([
      listActiveHabits(),
      listAllLogsInRange(startISO, endISO),
    ]);
    setHabits(hs);
    const m: WeekLogs = new Map();
    for (const l of ls) {
      const inner = m.get(l.habit_id) ?? new Map<string, number>();
      inner.set(l.date, l.value);
      m.set(l.habit_id, inner);
    }
    setWeekLogs(m);
  };

  useEffect(() => {
    refresh().catch(console.error);
  }, [dateISO]);

  const log = async (h: Habit, value: number) => {
    if (value === 0) await clearHabitLog(h.id, dateISO);
    else await upsertHabitLog(h.id, dateISO, value);
    await refresh();
  };

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  };

  // Resolve, for the viewed day, which habits are due and how far along they are.
  const wd = isoWeekday(fromISODate(dateISO));
  const due = habits
    .map((h) => {
      const sched = parseSchedule(h.schedule);
      if (!isScheduledWeekday(sched, wd)) return null; // not on the menu today
      const inner = weekLogs.get(h.id);
      const value = inner?.get(dateISO) ?? 0;
      const dayDone = isCompleted(h, value);
      let weekDone = 0;
      if (sched.kind === "weekly") {
        for (const v of inner?.values() ?? []) if (isCompleted(h, v)) weekDone++;
      }
      const quotaMet = sched.kind === "weekly" && weekDone >= sched.count;
      return { h, sched, value, dayDone, weekDone, quotaMet };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Nothing scheduled for this day → keep the day view uncluttered.
  if (due.length === 0) return null;

  // Completed-today (and quota-met weekly) habits drop off the list.
  const pending = due.filter((x) => !x.dayDone && !x.quotaMet);

  return (
    <div className="task-section">
      <button
        className={`habit-section-title ${collapsed ? "is-collapsed" : ""}`}
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
      >
        <span className="habit-section-caret">▾</span>
        {isToday
          ? t("今日习惯", "Today's habits")
          : t("当日习惯", "Habits for this day")}
        <span className="habit-section-count">{pending.length}</span>
      </button>
      {!collapsed &&
        (pending.length === 0 ? (
          <div className="empty-small">
            {t("今日习惯已全部完成 🎉", "All habits done for today 🎉")}
          </div>
        ) : (
          <div className="task-list">
            {pending.map(({ h, sched, value, weekDone }) => (
              <div key={h.id} className="today-habit-strip">
                <span className="today-habit-emoji">{h.emoji}</span>
                <span className="today-habit-name">{h.name}</span>
                {sched.kind === "weekly" && (
                  <span className="today-habit-week">
                    {t(`本周 ${weekDone}/${sched.count}`, `${weekDone}/${sched.count} this wk`)}
                  </span>
                )}
                {h.kind === "binary" ? (
                  <button className="today-habit-btn" onClick={() => log(h, 1)}>
                    {t("标记完成", "Mark done")}
                  </button>
                ) : (
                  <>
                    <span className="today-habit-target">
                      / {h.target_value} {h.unit ?? ""}
                    </span>
                    <QuantInput
                      initial={value}
                      onChange={(v) => log(h, v)}
                      placeholder="0"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

function QuantInput({
  initial,
  onChange,
  placeholder,
}: {
  initial: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  const [val, setVal] = useState(initial > 0 ? String(initial) : "");
  useEffect(() => {
    setVal(initial > 0 ? String(initial) : "");
  }, [initial]);
  const commit = () => {
    const n = Number(val);
    if (!isNaN(n) && n !== initial) onChange(n);
  };
  return (
    <input
      className="today-habit-input"
      type="number"
      step="0.1"
      min={0}
      placeholder={placeholder}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
