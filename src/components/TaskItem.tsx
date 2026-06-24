import type { PointerEventHandler } from "react";
import type { Task } from "../types";

interface Props {
  task: Task;
  dragging?: boolean;
  onTaskPointerDown?: PointerEventHandler<HTMLDivElement>;
  onToggle: (t: Task) => void;
  onDelete: (t: Task) => void;
  onEdit?: (t: Task) => void;
}

export default function TaskItem({
  task,
  dragging,
  onTaskPointerDown,
  onToggle,
  onDelete,
  onEdit,
}: Props) {
  const done = !!task.completed_at;
  return (
    <div
      className={`task-card ${done ? "done" : ""} ${dragging ? "dragging" : ""}`}
      data-task-id={task.id}
      onPointerDown={onTaskPointerDown}
    >
      <button
        className={`checkbox ${done ? "checked" : ""}`}
        onClick={() => onToggle(task)}
        aria-label={done ? "标记未完成" : "标记完成"}
      >
        {done ? (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6.2L4.8 9l5.2-6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </button>
      <div
        className="task-body"
        role={onEdit ? "button" : undefined}
        onClick={() => onEdit?.(task)}
        style={onEdit ? { cursor: "pointer" } : undefined}
      >
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          {task.subject ? <span className="subject-chip">{task.subject}</span> : null}
          {task.notes ? <span>· {task.notes}</span> : null}
        </div>
      </div>
      <div className="task-actions">
        {onEdit && (
          <button className="icon-btn" aria-label="编辑" onClick={() => onEdit(task)}>
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
        )}
        <button className="icon-btn" aria-label="删除" onClick={() => onDelete(task)}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
