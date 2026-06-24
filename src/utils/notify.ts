import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

let granted: boolean | null = null;

export async function ensurePermission(): Promise<boolean> {
  if (granted !== null) return granted;
  try {
    let ok = await isPermissionGranted();
    if (!ok) {
      const p = await requestPermission();
      ok = p === "granted";
    }
    granted = ok;
    return ok;
  } catch {
    granted = false;
    return false;
  }
}

export async function notify(title: string, body?: string): Promise<void> {
  const ok = await ensurePermission();
  if (!ok) return;
  try {
    sendNotification({ title, body });
  } catch (e) {
    console.error("notify failed", e);
  }
}
