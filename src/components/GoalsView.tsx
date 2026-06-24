import { useEffect, useState } from "react";
import { listDailyNotes } from "../db/database";
import type { DailyNote } from "../types";
import { addDays, formatDayHeader, fromISODate, toISODate } from "../utils/date";
import { useT } from "../i18n";
import { useSettings } from "../settings";

interface Props {
  /** Jump to a given day on the calendar (where the 今日小目标 is edited). */
  onOpenDay: (iso: string) => void;
}

export default function GoalsView({ onOpenDay }: Props) {
  const { t, lang } = useT();
  const { todayISO } = useSettings();
  const [notes, setNotes] = useState<DailyNote[]>([]);

  useEffect(() => {
    listDailyNotes()
      .then(setNotes)
      .catch(console.error);
  }, []);

  const yesterdayISO = toISODate(addDays(fromISODate(todayISO), -1));
  const dayLabel = (date: string): string => {
    if (date === todayISO) return t("今天", "Today");
    if (date === yesterdayISO) return t("昨天", "Yesterday");
    return formatDayHeader(fromISODate(date), lang);
  };

  return (
    <div>
      <div className="day-header">
        <div className="day-counts">
          {notes.length > 0
            ? t(
                `${notes.length} 天写下了今日小目标`,
                `${notes.length} day${notes.length === 1 ? "" : "s"} with a goal`,
              )
            : t("还没有记录", "Nothing logged yet")}
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="empty">
          {t(
            "还没有今日小目标。在日历页写下第一条吧。",
            "No daily goals yet. Jot the first one on the calendar.",
          )}
        </div>
      ) : (
        <div className="goals-feed">
          {notes.map((n) => (
            <button
              key={n.date}
              className="goals-item"
              onClick={() => onOpenDay(n.date)}
              title={t("在日历中打开这一天", "Open this day on the calendar")}
            >
              <span className="goals-rail" aria-hidden />
              <div className="goals-card">
                <div className="goals-card-date">{dayLabel(n.date)}</div>
                <div className="goals-card-text">{n.text}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
