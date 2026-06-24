import { useEffect } from "react";
import { useT } from "../i18n";

interface Props {
  onClose: () => void;
}

const SHORTCUTS = [
  ["Ctrl + N", "新建任务（任意视图）", "New task (any view)"],
  ["Ctrl + 1", "日历视图", "Calendar"],
  ["Ctrl + 2", "稍后收件箱", "Later inbox"],
  ["Ctrl + 3", "习惯", "Habits"],
  ["Ctrl + 4", "记录", "Records"],
  ["Ctrl + 5", "专注计时", "Focus timer"],
  ["Ctrl + 6", "学习统计", "Statistics"],
  ["Ctrl + 7", "今日小目标", "Daily goals"],
  ["Ctrl + /", "打开使用说明", "Open guide"],
  ["F1", "打开使用说明", "Open guide"],
  ["Esc", "关闭对话框", "Close dialog"],
] as const;

export default function HelpDialog({ onClose }: Props) {
  const { t } = useT();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="scrim" onMouseDown={onClose}>
      <div className="dialog help-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="help-head">
          <h2>{t("使用说明 / 快捷键", "Guide / Shortcuts")}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t("关闭", "Close")}>
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

        <div className="help-content">
          <section className="help-section">
            <h3>{t("常用操作", "Common Actions")}</h3>
            <ul className="help-list">
              <li>
                {t(
                  "任务按创建时间排序；长按任务卡片后拖动，可以调整同一列表中的位置。",
                  "Tasks are sorted by creation time by default; long-press a task card and drag to reorder it within the same list.",
                )}
              </li>
              <li>
                {t(
                  "点击任务正文编辑；点击圆形勾选框切换完成状态。",
                  "Click the task body to edit; click the round checkbox to toggle completion.",
                )}
              </li>
              <li>
                {t(
                  "没有日期的任务会进入「稍后」收件箱，之后可编辑任务再安排日期。",
                  "Undated tasks go to the Later inbox and can be scheduled later by editing the task.",
                )}
              </li>
              <li>
                {t(
                  "侧边栏底部可以导出 / 导入 JSON 备份。",
                  "Use the sidebar footer to export / import JSON backups.",
                )}
              </li>
            </ul>
          </section>

          <section className="help-section">
            <h3>{t("全局快捷键", "Global Shortcuts")}</h3>
            <div className="shortcut-table">
              {SHORTCUTS.map(([key, zh, en]) => (
                <div className="shortcut-row" key={key}>
                  <kbd>{key}</kbd>
                  <span>{t(zh, en)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
