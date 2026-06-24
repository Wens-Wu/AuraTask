import { useEffect, useMemo, useState } from "react";
import {
  listTasksInRange,
  recentFocusSessions,
  todayFocusStats,
} from "../db/database";
import type { FocusSession, Task } from "../types";
import type { FocusTimer } from "../hooks/useFocusTimer";
import { useT } from "../i18n";
import { useSettings } from "../settings";

interface Stats {
  sessions: number;
  totalMinutes: number;
}

interface Props {
  timer: FocusTimer;
}

export default function FocusView({ timer }: Props) {
  const { t } = useT();
  const { todayISO } = useSettings();
  const {
    settings,
    kind,
    running,
    remaining,
    totalSec,
    taskId,
    setTaskId,
    start,
    pause,
    reset,
    switchKind,
    finishNow,
    saveSettings,
    setOnSessionRecorded,
    setNotificationMessages,
  } = timer;

  const [showSettings, setShowSettings] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats>({ sessions: 0, totalMinutes: 0 });
  const [recent, setRecent] = useState<FocusSession[]>([]);

  const refreshStats = async () => {
    const today = todayISO;
    const [s, r] = await Promise.all([todayFocusStats(today), recentFocusSessions(6)]);
    setStats(s);
    setRecent(r);
  };

  useEffect(() => {
    listTasksInRange(todayISO, todayISO)
      .then((list) => {
        const openToday = list.filter((task) => task.completed_at == null);
        setTasks(openToday);
        if (taskId && !openToday.some((task) => task.id === taskId)) setTaskId("");
      })
      .catch(console.error);
    refreshStats().catch(console.error);
  }, [setTaskId, taskId, todayISO]);

  useEffect(() => {
    setOnSessionRecorded(() => {
      refreshStats().catch(console.error);
    });
    return () => setOnSessionRecorded(undefined);
  }, [setOnSessionRecorded]);

  useEffect(() => {
    setNotificationMessages({
      focusDone: {
        title: t("专注完成 🍅", "Focus done 🍅"),
        body: t(
          `${settings.focusMin} 分钟到了，去休息一下吧。`,
          `${settings.focusMin} minutes up. Time for a break.`,
        ),
      },
      breakDone: {
        title: t("休息结束 ☕", "Break over ☕"),
        body: t("回来继续专注吧。", "Time to focus again."),
      },
    });
    return () => setNotificationMessages(undefined);
  }, [setNotificationMessages, settings.focusMin, t]);

  const progress = useMemo(() => 1 - remaining / totalSec, [remaining, totalSec]);
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  const RADIUS = 110;
  const CIRC = 2 * Math.PI * RADIUS;

  return (
    <div className="focus-wrap">
      <div className="focus-card">
        <div className="focus-card-head">
          <div className="focus-tabs">
            <button
              className={kind === "focus" ? "active" : ""}
              onClick={() => switchKind("focus")}
            >
              {t(`专注 · ${settings.focusMin} 分钟`, `Focus · ${settings.focusMin}m`)}
            </button>
            <button
              className={kind === "break" ? "active" : ""}
              onClick={() => switchKind("break")}
            >
              {t(`休息 · ${settings.breakMin} 分钟`, `Break · ${settings.breakMin}m`)}
            </button>
          </div>
          <button
            className="icon-btn"
            onClick={() => setShowSettings((s) => !s)}
            aria-label={t("时长设置", "Duration settings")}
            title={t("自定义时长", "Customize durations")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {showSettings && (
          <div className="focus-settings">
            <div className="field">
              <label>{t("专注时长（分钟）", "Focus length (minutes)")}</label>
              <input
                type="number"
                min={1}
                max={180}
                value={settings.focusMin}
                onChange={(e) =>
                  saveSettings({ ...settings, focusMin: Number(e.target.value) || 1 })
                }
              />
            </div>
            <div className="field">
              <label>{t("休息时长（分钟）", "Break length (minutes)")}</label>
              <input
                type="number"
                min={1}
                max={60}
                value={settings.breakMin}
                onChange={(e) =>
                  saveSettings({ ...settings, breakMin: Number(e.target.value) || 1 })
                }
              />
            </div>
            <div className="focus-settings-presets">
              <span>{t("预设：", "Presets:")}</span>
              <button
                type="button"
                onClick={() => saveSettings({ focusMin: 25, breakMin: 5 })}
              >
                25/5
              </button>
              <button
                type="button"
                onClick={() => saveSettings({ focusMin: 50, breakMin: 10 })}
              >
                50/10
              </button>
              <button
                type="button"
                onClick={() => saveSettings({ focusMin: 90, breakMin: 20 })}
              >
                90/20
              </button>
            </div>
          </div>
        )}

        <div className="ring-wrap">
          <svg width="260" height="260" viewBox="0 0 260 260">
            <circle
              cx="130"
              cy="130"
              r={RADIUS}
              stroke="var(--border)"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="130"
              cy="130"
              r={RADIUS}
              stroke={kind === "focus" ? "var(--accent)" : "#10b981"}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - progress)}
              transform="rotate(-90 130 130)"
              style={{ transition: "stroke-dashoffset 0.4s linear" }}
            />
          </svg>
          <div className="ring-label">
            <div className="time">
              {mm}:{ss}
            </div>
            <div className="kind-label">
              {kind === "focus"
                ? t("保持专注", "Stay focused")
                : t("短暂休息", "Short break")}
            </div>
          </div>
        </div>

        {kind === "focus" && (
          <div className="task-picker">
            <label>{t("正在专注于", "Focusing on")}</label>
            <select
              value={taskId}
              onChange={(e) => setTaskId(e.target.value ? Number(e.target.value) : "")}
              disabled={running}
            >
              <option value="">{t("— 自由专注 —", "— free focus —")}</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.subject ? `[${task.subject}] ` : ""}
                  {task.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="focus-actions">
          {!running ? (
            <button className="primary-btn big" onClick={start}>
              {t("开始", "Start")}
            </button>
          ) : (
            <button className="primary-btn big" onClick={pause}>
              {t("暂停", "Pause")}
            </button>
          )}
          <button className="ghost-btn big" onClick={reset}>
            {t("重置", "Reset")}
          </button>
          <button
            className="ghost-btn big focus-end"
            onClick={finishNow}
            disabled={remaining >= totalSec}
            title={t("结束并记录当前时长", "End and log current duration")}
          >
            {t("结束", "End")}
          </button>
        </div>
      </div>

      <div className="focus-side">
        <div className="stat-card">
          <div className="stat-label">{t("今日专注", "Today's focus")}</div>
          <div className="stat-value">
            {stats.totalMinutes}
            <span>{t("分钟", "min")}</span>
          </div>
          <div className="stat-sub">
            {t(`${stats.sessions} 个番茄钟`, `${stats.sessions} pomodoro${stats.sessions === 1 ? "" : "s"}`)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">{t("最近会话", "Recent sessions")}</div>
          {recent.length === 0 ? (
            <div className="empty-small">{t("还没有专注记录", "No focus sessions yet")}</div>
          ) : (
            <ul className="session-list">
              {recent.map((s) => (
                <li key={s.id}>
                  <span className="dot" />
                  <span className="time-small">
                    {new Date(s.started_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="dur">
                    {t(`${Math.round(s.duration_sec / 60)} 分`, `${Math.round(s.duration_sec / 60)} min`)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
