import { useCallback, useEffect, useMemo, useState } from "react";
import TaskDialog from "./components/TaskDialog";
import DayView from "./components/DayView";
import WeekView from "./components/WeekView";
import MonthView from "./components/MonthView";
import FocusView from "./components/FocusView";
import StatsView from "./components/StatsView";
import InboxView from "./components/InboxView";
import HabitsView from "./components/HabitsView";
import JournalView from "./components/JournalView";
import GoalsView from "./components/GoalsView";
import WindowControls from "./components/WindowControls";
import TopbarChips from "./components/TopbarChips";
import HelpDialog from "./components/HelpDialog";
import SettingsDialog from "./components/SettingsDialog";
import { useFocusTimer } from "./hooks/useFocusTimer";
import { useT } from "./i18n";
import { useSettings } from "./settings";
import {
  createTask,
  deleteTask,
  listInboxTasks,
  listMoodsInRange,
  listTasksInRange,
  toggleTask,
  updateTask,
  updateTaskPositions,
} from "./db/database";
import { notify } from "./utils/notify";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { NewTask, Task, TimeSlot, ViewMode } from "./types";
import {
  addDays,
  endOfMonth,
  formatDayHeader,
  formatMonth,
  formatWeekRange,
  startOfMonth,
  startOfWeek,
  toISODate,
  fromISODate,
} from "./utils/date";

function rangeFor(view: ViewMode, anchor: Date): [string, string] {
  if (view === "day") {
    const s = toISODate(anchor);
    return [s, s];
  }
  if (view === "week") {
    const s = startOfWeek(anchor);
    return [toISODate(s), toISODate(addDays(s, 6))];
  }
  const first = startOfMonth(anchor);
  const last = endOfMonth(anchor);
  const gridStart = startOfWeek(first);
  const gridEnd = addDays(gridStart, 41);
  return [
    toISODate(gridStart < first ? gridStart : first),
    toISODate(gridEnd > last ? gridEnd : last),
  ];
}

function headerLabel(view: ViewMode, anchor: Date, lang: "zh" | "en" = "zh"): string {
  if (view === "month") return formatMonth(anchor, lang);
  if (view === "week") {
    const s = startOfWeek(anchor);
    return formatWeekRange(s, addDays(s, 6), lang);
  }
  return formatDayHeader(anchor, lang);
}

type NavIconName =
  | "calendar"
  | "inbox"
  | "habits"
  | "journal"
  | "goals"
  | "focus"
  | "stats"
  | "settings";

function NavIcon({ name }: { name: NavIconName }) {
  const common = {
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg className="nav-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      {name === "calendar" && (
        <>
          <rect x="2.5" y="3.5" width="11" height="10" rx="2" {...common} />
          <path d="M5 2.5v2M11 2.5v2M2.8 6.5h10.4" {...common} />
        </>
      )}
      {name === "inbox" && (
        <>
          <path d="M3 4.5h10l-1 7H4L3 4.5z" {...common} />
          <path d="M5.5 9h1.2l.9 1.2h.8L9.3 9h1.2" {...common} />
        </>
      )}
      {name === "habits" && (
        <>
          <path d="M3.5 8.2 6.6 11.2 12.8 4.8" {...common} />
          <path d="M8 14A6 6 0 1 1 13.2 5" {...common} />
        </>
      )}
      {name === "journal" && (
        <>
          <path
            d="M3 3.8a1.3 1.3 0 0 1 1.3-1.3h7.4A1.3 1.3 0 0 1 13 3.8v5a1.3 1.3 0 0 1-1.3 1.3H6.5L4 12.5v-2.4h-.7A1.3 1.3 0 0 1 3 8.8v-5z"
            {...common}
          />
          <path d="M5.3 5.4h5.4M5.3 7.4h3.2" {...common} />
        </>
      )}
      {name === "goals" && (
        <>
          <path d="M4 2.5v11" {...common} />
          <path d="M4 3.3h7.3l-1.5 2.1 1.5 2.1H4" {...common} />
        </>
      )}
      {name === "focus" && (
        <>
          <circle cx="8" cy="8.5" r="4.8" {...common} />
          <path d="M8 5.5v3l2 1.2M6.5 2.5h3" {...common} />
        </>
      )}
      {name === "stats" && (
        <>
          <path d="M3 13h10" {...common} />
          <path d="M4.5 10.5v2M8 6.5v6M11.5 3.5v9" {...common} />
        </>
      )}
      {name === "settings" && (
        <>
          <circle cx="8" cy="8" r="2" {...common} />
          <path d="M8 2.7v1.2M8 12.1v1.2M4.3 4.3l.9.9M10.8 10.8l.9.9M2.7 8h1.2M12.1 8h1.2M4.3 11.7l.9-.9M10.8 5.2l.9-.9" {...common} />
        </>
      )}
    </svg>
  );
}

export default function App() {
  const { t, lang } = useT();
  const { todayISO } = useSettings();
  const [view, setView] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("auratask.lastCalendarView");
    return saved === "week" || saved === "month" ? (saved as ViewMode) : "day";
  });
  const [anchor, setAnchor] = useState(() => fromISODate(todayISO));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [moods, setMoods] = useState<Record<string, string>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addDateOverride, setAddDateOverride] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [lastCalendarView, setLastCalendarView] = useState<"day" | "week" | "month">(
    () => {
      const saved = localStorage.getItem("auratask.lastCalendarView");
      return saved === "week" || saved === "month" ? (saved as "week" | "month") : "day";
    },
  );

  useEffect(() => {
    if (view === "day" || view === "week" || view === "month") {
      setLastCalendarView(view);
      localStorage.setItem("auratask.lastCalendarView", view);
    }
  }, [view]);

  const isCalendarView = view === "day" || view === "week" || view === "month";

  const timer = useFocusTimer();

  useEffect(() => {
    const win = getCurrentWindow();
    let closing = false;
    const unlisten = win.onCloseRequested(async (event) => {
      if (closing) {
        event.preventDefault();
        return;
      }
      const hasActiveFocus =
        timer.running &&
        timer.kind === "focus" &&
        timer.remaining < timer.totalSec;
      if (!hasActiveFocus) return;

      event.preventDefault();
      closing = true;
      await timer.finishForExit();
      await win.destroy();
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, [
    timer.finishForExit,
    timer.kind,
    timer.remaining,
    timer.running,
    timer.totalSec,
  ]);

  const [sidebarHidden, setSidebarHidden] = useState(
    () => localStorage.getItem("auratask.sidebar.hidden") === "1",
  );

  const toggleSidebar = () => {
    setSidebarHidden((h) => {
      const next = !h;
      localStorage.setItem("auratask.sidebar.hidden", next ? "1" : "0");
      return next;
    });
  };

  const refresh = useCallback(async () => {
    if (
      view === "focus" ||
      view === "stats" ||
      view === "habits" ||
      view === "journal" ||
      view === "goals"
    )
      return;
    try {
      if (view === "inbox") {
        setTasks(await listInboxTasks());
        setMoods({});
      } else {
        const [s, e] = rangeFor(view, anchor);
        const [taskRows, moodRows] = await Promise.all([
          listTasksInRange(s, e),
          view === "week" || view === "month" ? listMoodsInRange(s, e) : Promise.resolve([]),
        ]);
        setTasks(taskRows);
        const map: Record<string, string> = {};
        for (const m of moodRows) map[m.date] = m.mood;
        setMoods(map);
      }
    } catch (err) {
      console.error("Failed to load tasks", err);
    }
  }, [view, anchor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (inField) return;
      if (e.key === "F1" || ((e.ctrlKey || e.metaKey) && e.key === "/")) {
        e.preventDefault();
        setShowHelp(true);
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setShowAdd(true);
        return;
      }
      // Ctrl+1..7 switch primary nav, in sidebar order.
      const map: Record<string, ViewMode> = {
        "1": lastCalendarView,
        "2": "inbox",
        "3": "habits",
        "4": "journal",
        "5": "goals",
        "6": "focus",
        "7": "stats",
      };
      if (map[e.key]) {
        e.preventDefault();
        setView(map[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lastCalendarView]);

  // Once-per-session daily summary on startup
  useEffect(() => {
    const today = todayISO;
    const stamp = sessionStorage.getItem("auratask.dailyNotifiedFor");
    if (stamp === today) return;
    sessionStorage.setItem("auratask.dailyNotifiedFor", today);
    listTasksInRange(today, today)
      .then((rows) => {
        const pending = rows.filter((t) => !t.completed_at).length;
        if (pending > 0) {
          notify(
            t("今日待办", "Today's tasks"),
            t(
              `今天还有 ${pending} 项任务等你处理。`,
              `You have ${pending} task${pending === 1 ? "" : "s"} on the docket today.`,
            ),
          );
        }
      })
      .catch(() => {});
  }, []);

  const navigate = (dir: -1 | 1) => {
    if (view === "day") setAnchor((a) => addDays(a, dir));
    else if (view === "week") setAnchor((a) => addDays(a, dir * 7));
    else setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1));
  };

  const onAdd = async (t: NewTask) => {
    await createTask(t);
    setShowAdd(false);
    setAddDateOverride(null);
    await refresh();
  };

  const onSaveEdit = async (t: NewTask) => {
    if (!editingTask) return;
    await updateTask(editingTask.id, t);
    setEditingTask(null);
    await refresh();
  };

  const onDeleteEdit = async () => {
    if (!editingTask) return;
    await deleteTask(editingTask.id);
    setEditingTask(null);
    await refresh();
  };

  const onToggle = async (t: Task) => {
    await toggleTask(t.id, !t.completed_at);
    await refresh();
  };
  const onDelete = async (t: Task) => {
    await deleteTask(t.id);
    await refresh();
  };
  const onReorder = async (orderedTasks: Task[]) => {
    await updateTaskPositions(orderedTasks.map((task) => task.id));
    await refresh();
  };
  const onMoveTask = async (task: Task, dueDate: string, slot: TimeSlot | null) => {
    if (task.due_date === dueDate && (task.time_slot ?? null) === slot) return;
    // Land the card in its new cell immediately, then persist and reconcile
    // (refresh restores the real state if the write fails).
    setTasks((prev) =>
      prev.map((x) => (x.id === task.id ? { ...x, due_date: dueDate, time_slot: slot } : x)),
    );
    try {
      await updateTask(task.id, { due_date: dueDate, time_slot: slot });
    } finally {
      await refresh();
    }
  };

  const defaultDateForAdd = useMemo(() => toISODate(anchor), [anchor]);
  // Whether the visible day/week/month already contains "today" — used to mute
  // the Today button when it would be a no-op.
  const isViewingToday = useMemo(() => {
    if (view === "day") return toISODate(anchor) === todayISO;
    if (view === "week") {
      const s = startOfWeek(anchor);
      return todayISO >= toISODate(s) && todayISO <= toISODate(addDays(s, 6));
    }
    const td = fromISODate(todayISO);
    return anchor.getFullYear() === td.getFullYear() && anchor.getMonth() === td.getMonth();
  }, [view, anchor, todayISO]);
  const openAddTask = (date?: Date) => {
    setAddDateOverride(date ? toISODate(date) : null);
    setShowAdd(true);
  };
  const visiblePending = tasks.filter((task) => !task.completed_at).length;
  const visibleDone = tasks.filter((task) => !!task.completed_at).length;

  return (
    <div className={`app ${sidebarHidden ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src="/app-logo.png" alt="" />
          <span className="brand-name">AuraTask</span>
          <button
            className="icon-btn sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={t("隐藏侧边栏", "Hide sidebar")}
            title={t("隐藏侧边栏", "Hide sidebar")}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 3l-5 5 5 5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <button
          className={`nav-item ${isCalendarView ? "active" : ""}`}
          onClick={() => setView(lastCalendarView)}
        >
          <NavIcon name="calendar" />
          <span>{t("日历", "Calendar")}</span>
        </button>
        <button
          className={`nav-item ${view === "inbox" ? "active" : ""}`}
          onClick={() => setView("inbox")}
        >
          <NavIcon name="inbox" />
          <span>{t("稍后", "Later")}</span>
        </button>
        <button
          className={`nav-item ${view === "habits" ? "active" : ""}`}
          onClick={() => setView("habits")}
        >
          <NavIcon name="habits" />
          <span>{t("习惯", "Habits")}</span>
        </button>
        <button
          className={`nav-item ${view === "journal" ? "active" : ""}`}
          onClick={() => setView("journal")}
        >
          <NavIcon name="journal" />
          <span>{t("记录", "Records")}</span>
        </button>
        <button
          className={`nav-item ${view === "goals" ? "active" : ""}`}
          onClick={() => setView("goals")}
        >
          <NavIcon name="goals" />
          <span>{t("今日小目标", "Daily goals")}</span>
        </button>
        <button
          className={`nav-item ${view === "focus" ? "active" : ""}`}
          onClick={() => setView("focus")}
        >
          <NavIcon name="focus" />
          <span>{t("番茄计时", "Focus")}</span>
        </button>
        <button
          className={`nav-item ${view === "stats" ? "active" : ""}`}
          onClick={() => setView("stats")}
        >
          <NavIcon name="stats" />
          <span>{t("统计", "Statistics")}</span>
        </button>
        <div style={{ marginTop: "auto" }} />
        <button className="nav-item" onClick={() => setShowSettings(true)}>
          <NavIcon name="settings" />
          <span>{t("设置", "Settings")}</span>
        </button>
      </aside>

      <main className="main">
        <div className="topbar" data-tauri-drag-region>
          {sidebarHidden && (
            <button
              className="icon-btn"
              onClick={toggleSidebar}
              aria-label={t("显示侧边栏", "Show sidebar")}
              title={t("显示侧边栏", "Show sidebar")}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2.5 4h11M2.5 8h11M2.5 12h11"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
          {view === "focus" ? (
            <>
              <h1>
                <NavIcon name="focus" />
                <span>{t("专注计时", "Focus")}</span>
              </h1>
              <div className="topbar-spacer" />
            </>
          ) : view === "stats" ? (
            <>
              <h1>
                <NavIcon name="stats" />
                <span>{t("学习统计", "Statistics")}</span>
              </h1>
              <div className="topbar-spacer" />
            </>
          ) : view === "inbox" ? (
            <>
              <h1>
                <NavIcon name="inbox" />
                <span>{t("稍后", "Later")}</span>
              </h1>
              <div className="topbar-spacer" />
            </>
          ) : view === "habits" ? (
            <>
              <h1>
                <NavIcon name="habits" />
                <span>{t("习惯养成", "Habits")}</span>
              </h1>
              <div className="topbar-spacer" />
            </>
          ) : view === "journal" ? (
            <>
              <h1>
                <NavIcon name="journal" />
                <span>{t("记录", "Records")}</span>
              </h1>
              <div className="topbar-spacer" />
            </>
          ) : view === "goals" ? (
            <>
              <h1>
                <NavIcon name="goals" />
                <span>{t("今日小目标", "Daily goals")}</span>
              </h1>
              <div className="topbar-spacer" />
            </>
          ) : (
            <>
              <div className="date-nav">
                <button
                  className="icon-btn"
                  onClick={() => navigate(-1)}
                  aria-label={t("上一个", "Previous")}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M10 3l-5 5 5 5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <h1>{headerLabel(view, anchor, lang)}</h1>
                <button
                  className="icon-btn"
                  onClick={() => navigate(1)}
                  aria-label={t("下一个", "Next")}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M6 3l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <span className="date-nav-divider" aria-hidden />
                <button
                  className={`today-btn ${isViewingToday ? "is-current" : ""}`}
                  onClick={() => setAnchor(fromISODate(todayISO))}
                  title={t("回到今天", "Jump to today")}
                >
                  {t("今天", "Today")}
                </button>
              </div>
              <div className="topbar-spacer" />
            </>
          )}

          <div className="topbar-trailing" data-tauri-drag-region={false}>
            <TopbarChips
              timer={timer}
              onJumpFocus={() => setView("focus")}
            />
            <WindowControls />
          </div>
        </div>

        <div className="content">
          {isCalendarView && (
            <div className="day-header">
              <div className="segmented">
                <button className={view === "day" ? "active" : ""} onClick={() => setView("day")}>
                  {t("日", "Day")}
                </button>
                <button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>
                  {t("周", "Week")}
                </button>
                <button
                  className={view === "month" ? "active" : ""}
                  onClick={() => setView("month")}
                >
                  {t("月", "Month")}
                </button>
              </div>
              <div className="day-header-actions">
                <div className="day-counts">
                  {t(
                    `${visiblePending} 项待办 · ${visibleDone} 项完成`,
                    `${visiblePending} pending · ${visibleDone} done`,
                  )}
                </div>
                <button className="primary-btn" onClick={() => openAddTask()}>
                  + {t("新建任务", "New task")}
                </button>
              </div>
            </div>
          )}
          {view === "day" && (
            <DayView
              date={anchor}
              tasks={tasks}
              onToggle={onToggle}
              onDelete={onDelete}
              onEdit={setEditingTask}
              onReorder={onReorder}
            />
          )}
          {view === "week" && (
            <WeekView
              anchor={anchor}
              tasks={tasks}
              moods={moods}
              onPickDay={(d) => {
                setAnchor(d);
                setView("day");
              }}
              onToggle={onToggle}
              onEdit={setEditingTask}
              onAddForDay={openAddTask}
              onMove={onMoveTask}
            />
          )}
          {view === "month" && (
            <MonthView
              anchor={anchor}
              tasks={tasks}
              moods={moods}
              onPickDay={(d) => {
                setAnchor(d);
                setView("day");
              }}
              onAddForDay={openAddTask}
              onMove={(task, dueDate) => onMoveTask(task, dueDate, task.time_slot ?? null)}
            />
          )}
          {view === "focus" && <FocusView timer={timer} />}
          {view === "stats" && <StatsView />}
          {view === "habits" && <HabitsView />}
          {view === "journal" && <JournalView />}
          {view === "goals" && (
            <GoalsView
              onOpenDay={(iso) => {
                setAnchor(fromISODate(iso));
                setView("day");
              }}
            />
          )}
          {view === "inbox" && (
            <InboxView
              tasks={tasks}
              onToggle={onToggle}
              onDelete={onDelete}
              onEdit={setEditingTask}
              onReorder={onReorder}
              onAddClick={() => openAddTask()}
            />
          )}
        </div>
      </main>

      {showAdd && (
        <TaskDialog
          defaultDate={addDateOverride ?? defaultDateForAdd}
          defaultNoDate={view === "inbox" && !addDateOverride}
          onCancel={() => {
            setShowAdd(false);
            setAddDateOverride(null);
          }}
          onSubmit={onAdd}
        />
      )}
      {editingTask && (
        <TaskDialog
          defaultDate={editingTask.due_date ?? todayISO}
          existing={editingTask}
          onCancel={() => setEditingTask(null)}
          onSubmit={onSaveEdit}
          onDelete={onDeleteEdit}
        />
      )}
      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}
      {showSettings && (
        <SettingsDialog
          onClose={() => setShowSettings(false)}
          onOpenHelp={() => setShowHelp(true)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
