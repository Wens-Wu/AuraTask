import { useCallback, useEffect, useRef, useState } from "react";
import { createFocusSession } from "../db/database";
import type { SessionKind } from "../types";
import { notify } from "../utils/notify";

const SETTINGS_KEY = "auratask.focus.settings.v1";
const DEFAULT_FOCUS = 25;
const DEFAULT_BREAK = 5;

export interface FocusSettings {
  focusMin: number;
  breakMin: number;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function loadSettings(): FocusSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { focusMin: DEFAULT_FOCUS, breakMin: DEFAULT_BREAK };
    const p = JSON.parse(raw);
    return {
      focusMin: clamp(Number(p.focusMin) || DEFAULT_FOCUS, 1, 180),
      breakMin: clamp(Number(p.breakMin) || DEFAULT_BREAK, 1, 60),
    };
  } catch {
    return { focusMin: DEFAULT_FOCUS, breakMin: DEFAULT_BREAK };
  }
}

export interface FocusTimer {
  settings: FocusSettings;
  kind: SessionKind;
  running: boolean;
  remaining: number;
  totalSec: number;
  taskId: number | "";
  setTaskId: (id: number | "") => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  switchKind: (k: SessionKind) => void;
  finishNow: () => void;
  finishForExit: () => Promise<void>;
  saveSettings: (next: FocusSettings) => void;
  onSessionRecorded?: () => void;
  setOnSessionRecorded: (fn: (() => void) | undefined) => void;
  setNotificationMessages: (m: NotifMessages | undefined) => void;
}

export interface NotifMessages {
  focusDone: { title: string; body: string };
  breakDone: { title: string; body: string };
}

export function useFocusTimer(): FocusTimer {
  const [settings, setSettings] = useState<FocusSettings>(() => loadSettings());
  const [kind, setKind] = useState<SessionKind>("focus");
  const [running, setRunning] = useState(false);
  const [taskId, setTaskId] = useState<number | "">("");
  const startedRef = useRef<string | null>(null);
  const finishingRef = useRef(false);
  const runningRef = useRef(running);
  const kindRef = useRef(kind);
  const taskIdRef = useRef(taskId);
  const remainingRef = useRef(0);
  const totalSecRef = useRef(0);
  const onRecordedRef = useRef<(() => void) | undefined>(undefined);
  const notifMsgsRef = useRef<NotifMessages | undefined>(undefined);

  const totalSec = kind === "focus" ? settings.focusMin * 60 : settings.breakMin * 60;
  const [remaining, setRemaining] = useState(totalSec);
  runningRef.current = running;
  kindRef.current = kind;
  taskIdRef.current = taskId;
  remainingRef.current = remaining;
  totalSecRef.current = totalSec;

  // Keep the displayed time in sync when the duration changes (settings edit or
  // kind switch) while idle. Intentionally NOT triggered by `running` — doing so
  // would reset the countdown on pause. reset()/switchKind()/finishSession()
  // each set `remaining` themselves.
  useEffect(() => {
    if (!running) setRemaining(totalSec);
  }, [totalSec]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishSession = useCallback(async (durationSec = totalSec, notifyDone = true) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    const started = startedRef.current ?? new Date().toISOString();
    const ended = new Date().toISOString();
    const currentKind = kind;
    const currentTotal = totalSec;
    const recordedDuration = clamp(Math.round(durationSec), 1, currentTotal);
    try {
      await createFocusSession({
        task_id: currentKind === "focus" && taskId !== "" ? Number(taskId) : null,
        kind: currentKind,
        duration_sec: recordedDuration,
        started_at: started,
        ended_at: ended,
      });
      onRecordedRef.current?.();
    } catch (e) {
      console.error(e);
    } finally {
      finishingRef.current = false;
    }
    startedRef.current = null;
    setRunning(false);
    const nextKind: SessionKind = currentKind === "focus" ? "break" : "focus";
    setKind(nextKind);
    setRemaining(
      nextKind === "focus" ? settings.focusMin * 60 : settings.breakMin * 60,
    );
    if (!notifyDone) return;
    if (currentKind === "focus") {
      const msgs = notifMsgsRef.current?.focusDone ?? {
        title: "专注完成 🍅",
        body: `${settings.focusMin} 分钟到了，去休息一下吧。`,
      };
      notify(msgs.title, msgs.body);
    } else {
      const msgs = notifMsgsRef.current?.breakDone ?? {
        title: "休息结束 ☕",
        body: "回来继续专注吧。",
      };
      notify(msgs.title, msgs.body);
    }
  }, [kind, taskId, totalSec, settings.focusMin, settings.breakMin]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r > 1) return r - 1;
        clearInterval(id);
        finishSession();
        return 0;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, finishSession]);

  const start = useCallback(() => {
    if (!startedRef.current) startedRef.current = new Date().toISOString();
    setRunning(true);
  }, []);
  const pause = useCallback(() => setRunning(false), []);
  const reset = useCallback(() => {
    setRunning(false);
    setRemaining(totalSec);
    startedRef.current = null;
  }, [totalSec]);

  const switchKind = useCallback(
    (k: SessionKind) => {
      setKind(k);
      setRunning(false);
      setRemaining(k === "focus" ? settings.focusMin * 60 : settings.breakMin * 60);
      startedRef.current = null;
    },
    [settings.focusMin, settings.breakMin],
  );

  const finishNow = useCallback(() => {
    if (!startedRef.current) return;
    const elapsed = totalSec - remaining;
    if (elapsed <= 0) return;
    void finishSession(elapsed, false);
  }, [finishSession, remaining, totalSec]);

  const finishForExit = useCallback(async () => {
    if (
      finishingRef.current ||
      !runningRef.current ||
      kindRef.current !== "focus" ||
      !startedRef.current
    )
      return;
    const elapsed = totalSecRef.current - remainingRef.current;
    if (elapsed <= 0) return;

    finishingRef.current = true;
    try {
      await createFocusSession({
        task_id: taskIdRef.current === "" ? null : Number(taskIdRef.current),
        kind: "focus",
        duration_sec: clamp(Math.round(elapsed), 1, totalSecRef.current),
        started_at: startedRef.current,
        ended_at: new Date().toISOString(),
      });
      startedRef.current = null;
      runningRef.current = false;
    } catch (e) {
      console.error(e);
    } finally {
      finishingRef.current = false;
    }
  }, []);

  const saveSettings = useCallback((next: FocusSettings) => {
    const clamped: FocusSettings = {
      focusMin: clamp(next.focusMin, 1, 180),
      breakMin: clamp(next.breakMin, 1, 60),
    };
    setSettings(clamped);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(clamped));
  }, []);

  const setOnSessionRecorded = useCallback((fn: (() => void) | undefined) => {
    onRecordedRef.current = fn;
  }, []);

  const setNotificationMessages = useCallback((m: NotifMessages | undefined) => {
    notifMsgsRef.current = m;
  }, []);

  return {
    settings,
    kind,
    running,
    remaining,
    totalSec,
    taskId,
    setTaskId,
    start,
    pause,
    reset,
    switchKind,
    finishNow,
    finishForExit,
    saveSettings,
    setOnSessionRecorded,
    setNotificationMessages,
  };
}
