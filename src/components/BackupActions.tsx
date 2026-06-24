import { useState } from "react";
import { exportBackup, importBackup } from "../utils/backup";
import { useT } from "../i18n";

interface Props {
  onChanged: () => void;
}

export default function BackupActions({ onChanged }: Props) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const path = await exportBackup();
      if (path) alert(t(`已导出到\n${path}`, `Saved to\n${path}`));
    } catch (e) {
      alert(t(`导出失败：${(e as Error).message}`, `Export failed: ${(e as Error).message}`));
    } finally {
      setBusy(false);
    }
  };

  const onImport = async () => {
    if (busy) return;
    if (
      !confirm(
        t(
          "导入会清空当前所有数据并替换为备份文件中的数据，是否继续？",
          "Importing will wipe ALL current data and replace it with the backup. Continue?",
        ),
      )
    )
      return;
    setBusy(true);
    try {
      const res = await importBackup();
      if (res) {
        alert(
          t(
            `已导入 ${res.replaced} 个任务（及其他数据）。`,
            `Imported ${res.replaced} task${res.replaced === 1 ? "" : "s"} (plus other data).`,
          ),
        );
        onChanged();
      }
    } catch (e) {
      alert(t(`导入失败：${(e as Error).message}`, `Import failed: ${(e as Error).message}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="backup-actions">
      <button className="nav-item" onClick={onExport} disabled={busy}>
        <span>💾</span>
        <span>{t("导出备份", "Export backup")}</span>
      </button>
      <button className="nav-item" onClick={onImport} disabled={busy}>
        <span>📂</span>
        <span>{t("导入备份", "Import backup")}</span>
      </button>
    </div>
  );
}
