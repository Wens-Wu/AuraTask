import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useT } from "../i18n";

export default function WindowControls() {
  const { t } = useT();
  const [maximized, setMaximized] = useState(false);
  const win = getCurrentWindow();

  useEffect(() => {
    let mounted = true;
    win.isMaximized().then((v) => {
      if (mounted) setMaximized(v);
    });
    const unlistenP = win.onResized(async () => {
      const v = await win.isMaximized();
      if (mounted) setMaximized(v);
    });
    return () => {
      mounted = false;
      unlistenP.then((un) => un());
    };
  }, [win]);

  return (
    <div className="window-controls" data-tauri-drag-region={false}>
      <button
        className="winctrl winctrl-min"
        title={t("最小化", "Minimize")}
        onClick={() => win.minimize()}
        aria-label={t("最小化", "Minimize")}
      />
      <button
        className="winctrl winctrl-max"
        title={maximized ? t("还原", "Restore") : t("最大化", "Maximize")}
        onClick={() => win.toggleMaximize()}
        aria-label={t("最大化", "Maximize")}
      />
      <button
        className="winctrl winctrl-close"
        title={t("关闭", "Close")}
        onClick={() => win.close()}
        aria-label={t("关闭", "Close")}
      />
    </div>
  );
}
