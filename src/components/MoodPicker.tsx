import { MOOD_OPTIONS } from "../types";
import { useT } from "../i18n";

interface Props {
  value: string | null;
  onPick: (emoji: string, score: number) => void;
  onClear: () => void;
}

export default function MoodPicker({ value, onPick, onClear }: Props) {
  const { t, lang } = useT();
  return (
    <div className="mood-picker">
      <span className="mood-label">{t("今日心情", "Mood today")}</span>
      <div className="mood-options">
        {MOOD_OPTIONS.map((m) => (
          <button
            key={m.emoji}
            className={`mood-btn ${value === m.emoji ? "selected" : ""}`}
            title={lang === "zh" ? m.label : m.labelEn}
            onClick={() => onPick(m.emoji, m.score)}
          >
            {m.emoji}
          </button>
        ))}
        {value && (
          <button className="mood-clear" onClick={onClear} title={t("清除", "Clear")}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}
