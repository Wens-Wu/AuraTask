import { useT } from "../i18n";

export default function LangToggle() {
  const { lang, setLang } = useT();
  const next = lang === "zh" ? "en" : "zh";
  return (
    <button
      className="theme-toggle"
      onClick={() => setLang(next)}
      title={lang === "zh" ? "Switch to English" : "切换到中文"}
    >
      <span className="theme-toggle-icon">🌐</span>
      <span>{lang === "zh" ? "中文" : "English"}</span>
    </button>
  );
}
