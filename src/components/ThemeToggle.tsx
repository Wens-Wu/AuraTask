import { useEffect, useState } from "react";
import { useT } from "../i18n";

type Theme = "light" | "dark";

const KEY = "auratask.theme";

function readInitial(): Theme {
  const saved = localStorage.getItem(KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ThemeToggle() {
  const { t } = useT();
  const [theme, setTheme] = useState<Theme>(() => readInitial());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      title={
        theme === "dark"
          ? t("切换到日间模式", "Switch to light mode")
          : t("切换到夜间模式", "Switch to dark mode")
      }
    >
      <span className="theme-toggle-icon">{theme === "dark" ? "☀️" : "🌙"}</span>
      <span>
        {theme === "dark" ? t("日间", "Light") : t("夜间", "Dark")}
      </span>
    </button>
  );
}
