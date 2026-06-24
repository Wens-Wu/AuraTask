import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { Task } from "../types";
import { monthGrid, toISODate } from "../utils/date";
import { useT } from "../i18n";
import { useSettings } from "../settings";

// Custom color only while open; completed tasks keep the muted done-style.
const taskColorStyle = (t: Task): CSSProperties | undefined =>
  !t.completed_at && t.color
    ? ({ color: t.color, "--task-color": t.color } as CSSProperties)
    : undefined;

interface Props {
  anchor: Date;
  tasks: Task[];
  moods: Record<string, string>;
  onPickDay: (d: Date) => void;
  onAddForDay: (d: Date) => void;
  onMove: (task: Task, dueDate: string) => void;
}

const HEAD_ZH = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const HEAD_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The day cell sitting under the cursor, if any. */
function findDropDay(x: number, y: number): string | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const cell = (el as HTMLElement).closest?.(".month-cell[data-day]") as HTMLElement | null;
    if (cell?.dataset.day) return cell.dataset.day;
  }
  return null;
}

export default function MonthView({
  anchor,
  tasks,
  moods,
  onPickDay,
  onAddForDay,
  onMove,
}: Props) {
  const { lang } = useT();
  const { isToday } = useSettings();
  const [openMoreDay, setOpenMoreDay] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ task: Task; x: number; y: number } | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);
  const suppressClickRef = useRef(false);
  const HEAD = lang === "zh" ? HEAD_ZH : HEAD_EN;
  const cells = monthGrid(anchor);
  const byDay = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.due_date) continue;
    const arr = byDay.get(t.due_date) ?? [];
    arr.push(t);
    byDay.set(t.due_date, arr);
  }

  // Pointer-drag a task card onto another day cell to reschedule it.
  // A ≥5px move starts the drag; a smaller move stays a click (opens the day).
  const startPress = (e: PointerEvent<HTMLDivElement>, task: Task) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let started = false;
    let cancelled = false;
    const dropRef = { current: null as string | null };

    const handleMove = (ev: globalThis.PointerEvent) => {
      if (!started) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        started = true;
        suppressClickRef.current = true;
      }
      const target = findDropDay(ev.clientX, ev.clientY);
      dropRef.current = target;
      setDropDay(target);
      setDrag({ task, x: ev.clientX, y: ev.clientY });
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      window.removeEventListener("keydown", handleKey);
      setDrag(null);
      setDropDay(null);
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    };

    const handleUp = () => {
      const target = dropRef.current;
      if (started && !cancelled && target && target !== task.due_date) {
        onMove(task, target);
      }
      cleanup();
    };

    const handleKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        cancelled = true;
        cleanup();
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    window.addEventListener("keydown", handleKey);
  };

  return (
    <>
      <div className={`month-grid ${drag ? "is-dragging" : ""}`}>
        {HEAD.map((h) => (
          <div key={h} className="month-head-cell">
            {h}
          </div>
        ))}
        {cells.map((d) => {
          const key = toISODate(d);
          const list = byDay.get(key) ?? [];
          const inMonth = d.getMonth() === anchor.getMonth();
          return (
            <div
              key={key}
              data-day={key}
              className={`month-cell ${inMonth ? "" : "other-month"} ${
                isToday(d) ? "today" : ""
              } ${dropDay === key ? "is-drop-target" : ""}`}
              onClick={() => {
                if (suppressClickRef.current) return;
                onPickDay(d);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                onAddForDay(d);
              }}
            >
              <div className="month-cell-head">
                <span className="month-cell-date">{d.getDate()}</span>
                {moods[key] && <span className="mood-badge">{moods[key]}</span>}
              </div>
              {list.slice(0, 3).map((t) => (
                <div
                  key={t.id}
                  className={`month-task ${t.completed_at ? "done" : ""} ${
                    drag?.task.id === t.id ? "is-dragging" : ""
                  }`}
                  style={taskColorStyle(t)}
                  onPointerDown={(e) => startPress(e, t)}
                  title={t.title}
                >
                  <span className="month-task-text">{t.title}</span>
                </div>
              ))}
              {list.length > 3 && (
                <button
                  className="month-more"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMoreDay((cur) => (cur === key ? null : key));
                  }}
                >
                  +{list.length - 3} 项
                </button>
              )}
              {openMoreDay === key && (
                <div className="month-popover" onClick={(e) => e.stopPropagation()}>
                  <div className="month-popover-head">
                    <span>{key}</span>
                    <button
                      className="month-popover-close"
                      onClick={() => setOpenMoreDay(null)}
                      aria-label="关闭"
                    >
                      ×
                    </button>
                  </div>
                  <div className="month-popover-list">
                    {list.map((task) => (
                      <div
                        key={task.id}
                        className={`month-popover-task ${task.completed_at ? "done" : ""}`}
                        style={taskColorStyle(task)}
                      >
                        {task.title}
                      </div>
                    ))}
                  </div>
                  <button
                    className="month-popover-link"
                    onClick={() => {
                      setOpenMoreDay(null);
                      onPickDay(d);
                    }}
                  >
                    查看当天
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {drag && (
        <div className="week-task-ghost" style={{ left: drag.x + 12, top: drag.y + 12 }}>
          <span
            className="week-task-ghost-dot"
            style={
              drag.task.color
                ? ({ "--task-color": drag.task.color } as CSSProperties)
                : undefined
            }
          />
          <span className="ellipsis">{drag.task.title}</span>
        </div>
      )}
    </>
  );
}
