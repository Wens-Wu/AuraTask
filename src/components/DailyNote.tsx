import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";

interface Props {
  value: string | null;
  onSave: (text: string) => void;
}

export default function DailyNote({ value, onSave }: Props) {
  const { t } = useT();
  const [draft, setDraft] = useState(value ?? "");
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync when the selected day (and thus its stored note) changes.
  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  // Auto-grow to fit content.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [draft]);

  const commit = () => {
    const next = draft.trim();
    if (next !== (value ?? "")) onSave(next);
  };

  return (
    <div className="daily-note">
      <textarea
        ref={taRef}
        className="daily-note-input"
        value={draft}
        rows={1}
        placeholder={t("今日小目标", "Today's small goal")}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
      />
    </div>
  );
}
