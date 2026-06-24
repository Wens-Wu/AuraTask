import { useEffect, useMemo, useState } from "react";
import {
  dailyMetricsInRange,
  listActiveHabits,
  listAllLogsInRange,
  listMoodsInRange,
  subjectBreakdown,
} from "../db/database";
import type { DayMetric, Habit, HabitLog, SubjectMetric } from "../types";
import {
  addDays,
  formatMonth,
  fromISODate,
  startOfWeek,
  toISODate,
  weekdayLabel,
} from "../utils/date";
import { completionRate, computeStreak, parseSchedule, streakUnit } from "../utils/habits";
import { useT } from "../i18n";
import { useSettings } from "../settings";

type Range = "week" | "month" | "year";

/** Daily focus-minutes goal, drawn as a reference line on the focus chart. */
const FOCUS_GOAL_MIN = 420;
/** Weekly focus-minutes goal for the month-view weekly chart. */
const WEEKLY_GOAL_MIN = 2100;

interface DayCell {
  date: Date;
  iso: string;
  focus_min: number;
  done: number;
  planned: number;
  mood: string | null;
  mood_score: number | null;
}

function buildCells(range: Range, anchor: Date): DayCell[] {
  if (range === "week") {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return {
        date: d,
        iso: toISODate(d),
        focus_min: 0,
        done: 0,
        planned: 0,
        mood: null,
        mood_score: null,
      };
    });
  }
  if (range === "year") {
    const y = anchor.getFullYear();
    const yearStart = new Date(y, 0, 1);
    const days = Math.round(
      (new Date(y + 1, 0, 1).getTime() - yearStart.getTime()) / 86400000,
    );
    return Array.from({ length: days }, (_, i) => {
      const d = addDays(yearStart, i);
      return {
        date: d,
        iso: toISODate(d),
        focus_min: 0,
        done: 0,
        planned: 0,
        mood: null,
        mood_score: null,
      };
    });
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const n = last.getDate();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(first.getFullYear(), first.getMonth(), i + 1);
    return {
      date: d,
      iso: toISODate(d),
      focus_min: 0,
      done: 0,
      planned: 0,
      mood: null,
      mood_score: null,
    };
  });
}

export default function StatsView() {
  const { t, lang } = useT();
  const { todayISO } = useSettings();
  const [range, setRange] = useState<Range>("week");
  const [anchor, setAnchor] = useState(() => fromISODate(todayISO));
  const [cells, setCells] = useState<DayCell[]>([]);
  const [subjects, setSubjects] = useState<SubjectMetric[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);

  useEffect(() => {
    const base = buildCells(range, anchor);
    if (base.length === 0) return;
    const startISO = base[0].iso;
    const endISO = base[base.length - 1].iso;
    Promise.all([
      dailyMetricsInRange(startISO, endISO),
      subjectBreakdown(startISO, endISO),
      listMoodsInRange(startISO, endISO),
      listActiveHabits(),
      listAllLogsInRange(startISO, endISO),
    ])
      .then(([metrics, subj, moods, hs, logs]) => {
        setHabits(hs);
        setHabitLogs(logs);
        const idx = new Map<string, DayMetric>();
        metrics.forEach((m) => idx.set(m.date, m));
        const moodIdx = new Map<string, { mood: string; score: number }>();
        moods.forEach((m) => moodIdx.set(m.date, { mood: m.mood, score: m.score }));
        setCells(
          base.map((c) => {
            const m = idx.get(c.iso);
            const mo = moodIdx.get(c.iso);
            return {
              ...c,
              focus_min: m ? m.focus_min : 0,
              done: m ? m.done : 0,
              planned: m ? m.planned : 0,
              mood: mo ? mo.mood : null,
              mood_score: mo ? mo.score : null,
            };
          }),
        );
        setSubjects(subj);
      })
      .catch(console.error);
  }, [range, anchor]);

  const totals = useMemo(() => {
    let mins = 0;
    let done = 0;
    let planned = 0;
    let activeDays = 0;
    for (const c of cells) {
      mins += c.focus_min;
      done += c.done;
      planned += c.planned;
      if (c.focus_min > 0 || c.done > 0) activeDays++;
    }
    const rate = planned === 0 ? 0 : Math.round((done / planned) * 100);
    return { mins, done, planned, activeDays, rate };
  }, [cells]);

  // Focus minutes grouped into Monday-start weeks (only meaningful in month range).
  const weeklyFocus = useMemo(() => {
    if (range !== "month") return [];
    const buckets = new Map<string, { start: Date; mins: number }>();
    for (const c of cells) {
      const start = startOfWeek(c.date);
      const key = toISODate(start);
      const b = buckets.get(key) ?? { start, mins: 0 };
      b.mins += c.focus_min;
      buckets.set(key, b);
    }
    return Array.from(buckets.values()).sort(
      (a, b) => a.start.getTime() - b.start.getTime(),
    );
  }, [range, cells]);

  // Focus minutes grouped into the 12 calendar months (only used in year range).
  const monthlyFocus = useMemo(() => {
    if (range !== "year") return [];
    const buckets = Array.from({ length: 12 }, () => ({ mins: 0, days: 0 }));
    for (const c of cells) {
      const b = buckets[c.date.getMonth()];
      b.mins += c.focus_min;
      b.days += 1;
    }
    return buckets.map((b, month) => ({ month, mins: b.mins, days: b.days }));
  }, [range, cells]);

  const totalSubjFocus = subjects.reduce((s, x) => s + x.focus_min, 0);

  const shift = (dir: -1 | 1) => {
    if (range === "week") setAnchor((a) => addDays(a, dir * 7));
    else if (range === "year") setAnchor((a) => new Date(a.getFullYear() + dir, 0, 1));
    else setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1));
  };

  const rangeLabel =
    range === "week"
      ? (() => {
          const s = startOfWeek(anchor);
          const e = addDays(s, 6);
          return `${s.getMonth() + 1}/${s.getDate()} – ${e.getMonth() + 1}/${e.getDate()}`;
        })()
      : range === "year"
        ? String(anchor.getFullYear())
        : formatMonth(anchor, lang);

  const PALETTE = ["#4f46e5", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#a855f7", "#94a3b8"];

  return (
    <div className="stats-wrap">
      <div className="stats-toolbar">
        <div className="segmented">
          <button
            className={range === "week" ? "active" : ""}
            onClick={() => setRange("week")}
          >
            {t("本周", "This week")}
          </button>
          <button
            className={range === "month" ? "active" : ""}
            onClick={() => setRange("month")}
          >
            {t("本月", "This month")}
          </button>
          <button
            className={range === "year" ? "active" : ""}
            onClick={() => setRange("year")}
          >
            {t("本年", "This year")}
          </button>
        </div>
        <div className="stats-nav">
          <button
            className="icon-btn"
            onClick={() => shift(-1)}
            aria-label={t("上一段", "Previous period")}
          >
            ‹
          </button>
          <span className="stats-nav-label">{rangeLabel}</span>
          <button
            className="icon-btn"
            onClick={() => shift(1)}
            aria-label={t("下一段", "Next period")}
          >
            ›
          </button>
          <button className="today-btn" onClick={() => setAnchor(fromISODate(todayISO))}>
            {t("回到今天", "Back to today")}
          </button>
        </div>
      </div>

      <div className="kpi-row">
        <Kpi
          label={t("专注总时长", "Focus time")}
          value={totals.mins}
          unit={t("分钟", "min")}
          accent="#4f46e5"
        />
        <Kpi
          label={t("完成任务", "Tasks done")}
          value={totals.done}
          unit={t(`/ ${totals.planned} 项`, `/ ${totals.planned}`)}
          accent="#10b981"
        />
        <Kpi
          label={t("完成率", "Completion")}
          value={totals.rate}
          unit="%"
          accent="#f59e0b"
        />
        <Kpi
          label={t("活跃天数", "Active days")}
          value={totals.activeDays}
          unit={t(`/ ${cells.length} 天`, `/ ${cells.length} d`)}
          accent="#ec4899"
        />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>{t("专注分钟数", "Focus minutes")}</h3>
          <span className="panel-sub">
            {range === "year"
              ? t(`每月累计 · 目标 ${FOCUS_GOAL_MIN} 分钟/天`, `Per month · goal ${FOCUS_GOAL_MIN} min/day`)
              : t(`每日累计 · 目标 ${FOCUS_GOAL_MIN} 分钟`, `Per day · goal ${FOCUS_GOAL_MIN} min`)}
          </span>
        </div>
        {range === "year" ? (
          <div className="bar-chart" style={{ gridTemplateColumns: "repeat(12, 1fr)" }}>
            {monthlyFocus.map((m) => {
              const goal = m.days * FOCUS_GOAL_MIN;
              const fillPx = (goal > 0 ? Math.min(1, m.mins / goal) : 0) * 160;
              return (
                <div
                  key={m.month}
                  className="bar-col"
                  title={t(`${m.month + 1} 月：${m.mins} 分钟`, `Month ${m.month + 1}: ${m.mins} min`)}
                >
                  <div className="bar-value">{m.mins || ""}</div>
                  <div className="focus-track">
                    <div className="focus-fill" style={{ height: `${fillPx}px` }} />
                  </div>
                  <div className="bar-x">{m.month + 1}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`bar-chart ${range === "month" ? "dense" : ""}`}>
            {cells.map((c) => {
              // Bar = the 420-min goal; the dark fill is how much was focused.
              const fillPx = Math.min(1, c.focus_min / FOCUS_GOAL_MIN) * 160;
              const label =
                range === "week" ? weekdayLabel(c.date, lang) : String(c.date.getDate());
              return (
                <div
                  key={c.iso}
                  className="bar-col"
                  title={t(
                    `${c.iso}: ${c.focus_min} / ${FOCUS_GOAL_MIN} 分钟`,
                    `${c.iso}: ${c.focus_min} / ${FOCUS_GOAL_MIN} min`,
                  )}
                >
                  <div className="bar-value">{c.focus_min || ""}</div>
                  <div className="focus-track">
                    <div className="focus-fill" style={{ height: `${fillPx}px` }} />
                  </div>
                  <div className="bar-x">{label}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {range === "month" && weeklyFocus.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <h3>{t("每周专注时长", "Weekly focus")}</h3>
            <span className="panel-sub">
              {t(`目标 ${WEEKLY_GOAL_MIN} 分钟/周`, `goal ${WEEKLY_GOAL_MIN} min/week`)}
            </span>
          </div>
          <div
            className="bar-chart"
            style={{ gridTemplateColumns: `repeat(${weeklyFocus.length}, 1fr)` }}
          >
            {weeklyFocus.map((w) => {
              const fillPx = Math.min(1, w.mins / WEEKLY_GOAL_MIN) * 160;
              const label = `${w.start.getMonth() + 1}/${w.start.getDate()}`;
              return (
                <div
                  key={label}
                  className="bar-col"
                  title={t(`${label} 当周：${w.mins} 分钟`, `Week of ${label}: ${w.mins} min`)}
                >
                  <div className="bar-value">{w.mins || ""}</div>
                  <div className="focus-track">
                    <div className="focus-fill" style={{ height: `${fillPx}px` }} />
                  </div>
                  <div className="bar-x">{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {range !== "year" && (
        <div className="panel">
        <div className="panel-head">
          <h3>{t("心情走势", "Mood trend")}</h3>
          <span className="panel-sub">{t("5 最好 · 1 糟糕", "5 best · 1 worst")}</span>
        </div>
        {cells.every((c) => c.mood_score === null) ? (
          <div className="empty">
            {t("这段时间还没记录心情。", "No mood entries for this period yet.")}
          </div>
        ) : (
          <div className={`mood-track ${range === "month" ? "dense" : ""}`}>
            {cells.map((c) => {
              const score = c.mood_score ?? 0;
              const h = score === 0 ? 4 : 8 + (score - 1) * 36;
              const label =
                range === "week" ? weekdayLabel(c.date, lang) : String(c.date.getDate());
              return (
                <div
                  key={c.iso}
                  className="mood-col"
                  title={`${c.iso}: ${c.mood ?? t("未记录", "no record")}`}
                >
                  <div className="mood-emoji">{c.mood ?? ""}</div>
                  <div
                    className={`mood-bar score-${score}`}
                    style={{ height: `${h}px` }}
                  />
                  <div className="bar-x">{label}</div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      )}

      {habits.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <h3>{t("习惯坚持", "Habit consistency")}</h3>
            <span className="panel-sub">
              {range === "week"
                ? t("本周完成率", "This week's rate")
                : range === "year"
                  ? t("本年完成率", "This year's rate")
                  : t("本月完成率", "This month's rate")}
            </span>
          </div>
          <div className="habit-summary-list">
            {habits.map((h) => {
              const myLogs = habitLogs.filter((l) => l.habit_id === h.id);
              const logMap = new Map<string, number>();
              for (const l of myLogs) logMap.set(l.date, l.value);
              const streak = computeStreak(h, logMap, fromISODate(todayISO));
              const rate = completionRate(
                h,
                myLogs,
                cells[0]?.iso ?? todayISO,
                cells[cells.length - 1]?.iso ?? todayISO,
              );
              const streakLabel =
                streakUnit(parseSchedule(h.schedule)) === "week"
                  ? t(`🔥 ${streak} 周`, `🔥 ${streak} w`)
                  : t(`🔥 ${streak} 天`, `🔥 ${streak} d`);
              return (
                <div key={h.id} className="habit-summary-row">
                  <span className="habit-emoji">{h.emoji}</span>
                  <span className="habit-summary-name">{h.name}</span>
                  <span className="habit-summary-streak">{streakLabel}</span>
                  <div className="subject-bar" style={{ flex: 1 }}>
                    <div
                      className="subject-fill"
                      style={{
                        width: `${Math.max(2, rate)}%`,
                        background: "var(--accent)",
                      }}
                    />
                  </div>
                  <span className="habit-summary-rate">{rate}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h3>{t("标签分布", "Tag breakdown")}</h3>
          <span className="panel-sub">{t("按专注时长", "By focus minutes")}</span>
        </div>
        {subjects.length === 0 ? (
          <div className="empty">
            {t("这段时间还没有任务记录。", "No tasks recorded for this period yet.")}
          </div>
        ) : (
          <div className="subject-list">
            {subjects.map((s, i) => {
              const pct =
                totalSubjFocus === 0 ? 0 : Math.round((s.focus_min / totalSubjFocus) * 100);
              const color = PALETTE[i % PALETTE.length];
              return (
                <div key={s.subject} className="subject-row">
                  <div className="subject-name">
                    <span className="subject-swatch" style={{ background: color }} />
                    {s.subject}
                  </div>
                  <div className="subject-bar">
                    <div
                      className="subject-fill"
                      style={{ width: `${Math.max(2, pct)}%`, background: color }}
                    />
                  </div>
                  <div className="subject-meta">
                    {t(
                      `${s.focus_min} 分钟 · ${s.task_count} 任务`,
                      `${s.focus_min} min · ${s.task_count} task${s.task_count === 1 ? "" : "s"}`,
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: number;
  unit: string;
  accent: string;
}) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color: accent }}>
        {value}
        <span>{unit}</span>
      </div>
    </div>
  );
}
