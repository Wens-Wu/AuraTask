import type { FocusTimer } from "../hooks/useFocusTimer";
import { useT } from "../i18n";

interface Props {
  timer: FocusTimer;
  onJumpFocus: () => void;
}

export default function TopbarChips({
  timer,
  onJumpFocus,
}: Props) {
  const { t } = useT();

  const mm = String(Math.floor(timer.remaining / 60)).padStart(2, "0");
  const ss = String(timer.remaining % 60).padStart(2, "0");

  return (
    <div className="topbar-chips">
      {timer.running && (
        <button
          className={`chip chip-focus ${timer.kind === "break" ? "is-break" : ""}`}
          onClick={onJumpFocus}
          title={t("跳到专注计时", "Jump to focus timer")}
        >
          <span>{timer.kind === "focus" ? "🍅" : "☕"}</span>
          <span className="chip-time">
            {mm}:{ss}
          </span>
        </button>
      )}
    </div>
  );
}
