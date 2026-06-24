import { useEffect, useState, type CSSProperties } from "react";
import type { NewTask, Priority, Task, TimeSlot } from "../types";
import { TASK_COLORS, TIME_SLOT_ORDER, timeSlotLabel } from "../types";
import { useT } from "../i18n";

interface Props {
  defaultDate: string;
  defaultNoDate?: boolean;
  existing?: Task | null;
  onCancel: () => void;
  onSubmit: (t: NewTask) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}

export default function TaskDialog({
  defaultDate,
  defaultNoDate,
  existing,
  onCancel,
  onSubmit,
  onDelete,
}: Props) {
  const { t, lang } = useT();
  const editing = !!existing;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [subject, setSubject] = useState(existing?.subject ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [noDate, setNoDate] = useState(
    existing ? existing.due_date === null : !!defaultNoDate,
  );
  const [date, setDate] = useState(existing?.due_date ?? defaultDate);
  const [priority, setPriority] = useState<Priority>(existing?.priority ?? 1);
  const [slot, setSlot] = useState<TimeSlot | null>(existing?.time_slot ?? null);
  const [color, setColor] = useState<string | null>(existing?.color ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    await onSubmit({
      title: title.trim(),
      subject: subject.trim() || null,
      notes: notes.trim() || null,
      priority,
      due_date: noDate ? null : date,
      time_slot: noDate ? null : slot,
      color,
    });
    setBusy(false);
  };

  const handleDelete = async () => {
    if (!onDelete || busy) return;
    if (!confirm(t("确定删除这个任务？", "Delete this task?"))) return;
    setBusy(true);
    await onDelete();
    setBusy(false);
  };

  return (
    <div className="scrim" onMouseDown={onCancel}>
      <form className="dialog" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{editing ? t("编辑任务", "Edit task") : t("新建任务", "New task")}</h2>
        <div className="field">
          <label>{t("标题", "Title")}</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("例如：完成论文初稿引言部分", "e.g. Write introduction draft")}
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label>{t("日期", "Date")}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={noDate}
              style={noDate ? { opacity: 0.5 } : undefined}
            />
          </div>
          <div className="field">
            <label>{t("类型", "Type")}</label>
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) as Priority)}
            >
              <option value={1}>{t("主要", "Primary")}</option>
              <option value={0}>{t("延伸", "Secondary")}</option>
            </select>
          </div>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={noDate}
            onChange={(e) => setNoDate(e.target.checked)}
          />
          <span>
            {t(
              "暂不指定日期（放入「稍后」收件箱）",
              "No date yet (drop into Later)",
            )}
          </span>
        </label>

        {!noDate && (
          <div className="field">
            <label>{t("时间段", "Time of day")}</label>
            <div className="segmented slot-seg">
              <button
                type="button"
                className={slot === null ? "active" : ""}
                onClick={() => setSlot(null)}
              >
                {t("全天", "All day")}
              </button>
              {TIME_SLOT_ORDER.map((s) => (
                <button
                  type="button"
                  key={s}
                  className={`slot-${s} ${slot === s ? "active" : ""}`}
                  onClick={() => setSlot(s)}
                >
                  {timeSlotLabel(s, lang)}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="field">
          <label>{t("标签（可选）", "Tag (optional)")}</label>
          <input
            value={subject ?? ""}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("论文、组会、阅读…", "paper, group meeting, reading…")}
          />
        </div>
        <div className="field">
          <label>{t("颜色", "Color")}</label>
          <div className="color-picker">
            <button
              type="button"
              className={`color-dot is-default ${color === null ? "active" : ""}`}
              onClick={() => setColor(null)}
              title={t("默认", "Default")}
              aria-label={t("默认颜色", "Default color")}
            />
            {TASK_COLORS.map((c) => (
              <button
                type="button"
                key={c.value}
                className={`color-dot ${color === c.value ? "active" : ""}`}
                style={{ "--dot": c.value } as CSSProperties}
                onClick={() => setColor(c.value)}
                title={lang === "zh" ? c.label : c.labelEn}
                aria-label={lang === "zh" ? c.label : c.labelEn}
              />
            ))}
          </div>
        </div>
        <div className="field">
          <label>{t("备注（可选）", "Notes (optional)")}</label>
          <textarea value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="dialog-footer">
          {editing && onDelete && (
            <button
              type="button"
              className="ghost-btn danger"
              onClick={handleDelete}
              disabled={busy}
            >
              {t("删除", "Delete")}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button type="button" className="ghost-btn" onClick={onCancel}>
            {t("取消", "Cancel")}
          </button>
          <button type="submit" className="primary-btn" disabled={busy || !title.trim()}>
            {editing ? t("保存", "Save") : t("添加", "Add")}
          </button>
        </div>
      </form>
    </div>
  );
}
