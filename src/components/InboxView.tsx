import type { Task } from "../types";
import { useT } from "../i18n";
import TaskList from "./TaskList";

interface Props {
  tasks: Task[];
  onToggle: (t: Task) => void;
  onDelete: (t: Task) => void;
  onEdit: (t: Task) => void;
  onReorder: (tasks: Task[]) => void;
  onAddClick: () => void;
}

export default function InboxView({
  tasks,
  onToggle,
  onDelete,
  onEdit,
  onReorder,
  onAddClick,
}: Props) {
  const { t } = useT();
  const pending = tasks.filter((task) => !task.completed_at);
  const done = tasks.filter((task) => !!task.completed_at);

  return (
    <div>
      <div className="day-header">
        <div className="day-header-actions">
          <div className="day-counts">
            {t(
              `${pending.length} 项待办 · ${done.length} 项完成`,
              `${pending.length} pending · ${done.length} done`,
            )}
          </div>
          <button className="primary-btn" onClick={onAddClick}>
            + {t("新建任务", "New task")}
          </button>
        </div>
      </div>

      <div className="task-section">
        <div className="task-section-title">{t("待办", "To-do")}</div>
        {pending.length ? (
          <TaskList
            tasks={pending}
            onToggle={onToggle}
            onDelete={onDelete}
            onEdit={onEdit}
            onReorder={onReorder}
          />
        ) : (
          <div className="empty">
            {t("收件箱是空的。", "Inbox is empty.")}
            <button className="link-btn" onClick={onAddClick}>
              {t("添加一个没有日期的任务", "Add an undated task")}
            </button>
          </div>
        )}
      </div>

      {done.length > 0 && (
        <div className="task-section">
          <div className="task-section-title">{t("已完成", "Completed")}</div>
          <TaskList
            tasks={done}
            onToggle={onToggle}
            onDelete={onDelete}
            onEdit={onEdit}
            onReorder={onReorder}
          />
        </div>
      )}
    </div>
  );
}
