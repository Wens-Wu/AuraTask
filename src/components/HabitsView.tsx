import { useCallback, useEffect, useState } from "react";
import {
  archiveHabit,
  clearHabitLog,
  createHabit,
  deleteHabit,
  listAllHabits,
  listAllLogsInRange,
  updateHabit,
  upsertHabitLog,
} from "../db/database";
import type { Habit, HabitLog, NewHabit } from "../types";
import { addDays, fromISODate, toISODate } from "../utils/date";
import {
  completionRate,
  computeStreak,
  isCompleted,
  parseSchedule,
  scheduleSummary,
  streakUnit,
} from "../utils/habits";
import HabitDialog from "./HabitDialog";
import { useT } from "../i18n";
import { useSettings } from "../settings";

const HEATMAP_DAYS = 30;

export default function HabitsView() {
  const { t } = useT();
  const { todayISO } = useSettings();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logsByHabit, setLogsByHabit] = useState<Map<number, HabitLog[]>>(new Map());
  const [editing, setEditing] = useState<Habit | null>(null);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const refresh = useCallback(async () => {
    const all = await listAllHabits();
    const today = fromISODate(todayISO);
    const start = toISODate(addDays(today, -HEATMAP_DAYS + 1));
    const end = toISODate(today);
    const logs = await listAllLogsInRange(start, end);
    const map = new Map<number, HabitLog[]>();
    for (const l of logs) {
      const arr = map.get(l.habit_id) ?? [];
      arr.push(l);
      map.set(l.habit_id, arr);
    }
    setHabits(all);
    setLogsByHabit(map);
  }, [todayISO]);

  useEffect(() => {
    refresh().catch(console.error);
  }, [refresh]);

  const quickLog = async (h: Habit, value: number) => {
    if (value === 0) await clearHabitLog(h.id, todayISO);
    else await upsertHabitLog(h.id, todayISO, value);
    await refresh();
  };

  const onSubmit = async (data: NewHabit) => {
    if (editing) await updateHabit(editing.id, data);
    else await createHabit(data);
    setEditing(null);
    setCreating(false);
    await refresh();
  };

  const visible = habits.filter((h) => (showArchived ? true : !h.archived_at));

  return (
    <div>
      <div className="day-header">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          <span>{t("显示已归档", "Show archived")}</span>
        </label>
        <div className="day-header-actions">
          <button className="primary-btn" onClick={() => setCreating(true)}>
            + {t("新建习惯", "New habit")}
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          {t("还没有习惯。", "No habits yet.")}
          <button className="link-btn" onClick={() => setCreating(true)}>
            {t("创建第一个", "Create your first one")}
          </button>
        </div>
      ) : (
        <div className="habit-list">
          {visible.map((h) => (
            <HabitCard
              key={h.id}
              habit={h}
              logs={logsByHabit.get(h.id) ?? []}
              todayISO={todayISO}
              onQuickLog={(v) => quickLog(h, v)}
              onEdit={() => setEditing(h)}
            />
          ))}
        </div>
      )}

      {creating && (
        <HabitDialog onCancel={() => setCreating(false)} onSubmit={onSubmit} />
      )}
      {editing && (
        <HabitDialog
          existing={editing}
          onCancel={() => setEditing(null)}
          onSubmit={onSubmit}
          onDelete={async () => {
            await deleteHabit(editing.id);
            setEditing(null);
            await refresh();
          }}
          onArchiveToggle={async () => {
            await archiveHabit(editing.id, !editing.archived_at);
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function HabitCard({
  habit,
  logs,
  todayISO,
  onQuickLog,
  onEdit,
}: {
  habit: Habit;
  logs: HabitLog[];
  todayISO: string;
  onQuickLog: (value: number) => void;
  onEdit: () => void;
}) {
  const { t, lang } = useT();
  const todayDate = fromISODate(todayISO);
  const logMap = new Map<string, number>();
  for (const l of logs) logMap.set(l.date, l.value);

  const sched = parseSchedule(habit.schedule);
  const startISO = toISODate(addDays(todayDate, -(HEATMAP_DAYS - 1)));
  const streak = computeStreak(habit, logMap, todayDate);
  const rate = completionRate(habit, logs, startISO, todayISO);
  const todayValue = logMap.get(todayISO) ?? 0;
  const todayDone = isCompleted(habit, todayValue);

  const cells = Array.from({ length: HEATMAP_DAYS }, (_, i) => {
    const d = addDays(todayDate, -(HEATMAP_DAYS - 1 - i));
    const iso = toISODate(d);
    const v = logMap.get(iso);
    return { iso, value: v, ratio: ratioOf(habit, v) };
  });

  const [inputVal, setInputVal] = useState<string>(
    habit.kind === "quantity" && todayValue > 0 ? String(todayValue) : "",
  );

  return (
    <div className={`habit-card ${habit.archived_at ? "archived" : ""}`}>
      <div className="habit-card-head">
        <div className="habit-name">
          <span className="habit-emoji">{habit.emoji}</span>
          <span>{habit.name}</span>
          <span className="habit-sched-tag">{scheduleSummary(sched, lang)}</span>
          {habit.archived_at && (
            <span className="archived-tag">{t("已归档", "Archived")}</span>
          )}
        </div>
        <button className="icon-btn" onClick={onEdit} aria-label={t("编辑", "Edit")}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="habit-stats">
        <div>
          <span className="num">{streak}</span>
          <span className="lbl">
            {streakUnit(sched) === "week"
              ? t("周连续", "week streak")
              : t("天连续", "day streak")}
          </span>
        </div>
        <div>
          <span className="num">{rate}%</span>
          <span className="lbl">{t(`近 ${HEATMAP_DAYS} 天`, `last ${HEATMAP_DAYS} d`)}</span>
        </div>
        {habit.kind === "quantity" && (
          <div>
            <span className="num">
              {todayValue}
              <span className="num-unit">
                / {habit.target_value} {habit.unit ?? ""}
              </span>
            </span>
            <span className="lbl">{t("今日", "today")}</span>
          </div>
        )}
      </div>

      <div className="habit-heatmap">
        {cells.map((c) => (
          <div
            key={c.iso}
            className={`heat-cell heat-${quantize(c.ratio)} ${c.iso === todayISO ? "is-today" : ""}`}
            title={`${c.iso}: ${c.value ?? "—"}`}
          />
        ))}
      </div>

      {!habit.archived_at && (
        <div className="habit-actions">
          {habit.kind === "binary" ? (
            <button
              className={`primary-btn ${todayDone ? "muted" : ""}`}
              onClick={() => onQuickLog(todayDone ? 0 : 1)}
            >
              {todayDone ? t("✓ 今天已完成", "✓ Done for today") : t("标记今天完成", "Mark today done")}
            </button>
          ) : (
            <>
              <input
                type="number"
                step="0.1"
                min={0}
                placeholder={t(
                  `今天进度 (${habit.unit ?? ""})`,
                  `Today's progress (${habit.unit ?? ""})`,
                )}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const n = Number(inputVal);
                    if (!isNaN(n)) onQuickLog(n);
                  }
                }}
              />
              <button
                className="primary-btn"
                onClick={() => {
                  const n = Number(inputVal);
                  if (!isNaN(n)) onQuickLog(n);
                }}
              >
                {t("记录", "Log")}
              </button>
              {todayValue > 0 && (
                <button
                  className="ghost-btn"
                  onClick={() => {
                    setInputVal("");
                    onQuickLog(0);
                  }}
                >
                  {t("清除", "Clear")}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ratioOf(habit: Habit, value: number | undefined): number {
  if (value === undefined || value === 0) return 0;
  if (habit.kind === "binary") return 1;
  if (habit.target_value == null || habit.target_value === 0) return value > 0 ? 1 : 0;
  return Math.min(1, value / habit.target_value);
}

function quantize(ratio: number): number {
  if (ratio === 0) return 0;
  if (ratio < 0.34) return 1;
  if (ratio < 0.67) return 2;
  if (ratio < 1) return 3;
  return 4;
}
