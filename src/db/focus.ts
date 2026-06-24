import { logicalDateISO } from "../utils/date";
import { getDayStartHour } from "../utils/settings";
import type { FocusSession, NewFocusSession } from "../types";
import { getDb } from "./client";

export const createFocusSession = async (s: NewFocusSession): Promise<void> => {
  const db = await getDb();
  // Bucket the session into the logical day it started in (respects the
  // user's "day starts at" preference for night owls).
  const date = logicalDateISO(new Date(s.started_at), getDayStartHour());
  await db.execute(
    "INSERT INTO focus_sessions (task_id, kind, duration_sec, session_date, started_at, ended_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [s.task_id, s.kind, s.duration_sec, date, s.started_at, s.ended_at],
  );
};

export const todayFocusStats = async (
  dateISO: string,
): Promise<{ sessions: number; totalMinutes: number }> => {
  const db = await getDb();
  const rows = await db.select<{ sessions: number; total: number | null }[]>(
    "SELECT COUNT(*) as sessions, COALESCE(SUM(duration_sec),0) as total FROM focus_sessions WHERE kind='focus' AND session_date = $1",
    [dateISO],
  );
  const r = rows[0] ?? { sessions: 0, total: 0 };
  return { sessions: r.sessions, totalMinutes: Math.round((r.total ?? 0) / 60) };
};

export const recentFocusSessions = async (limit = 8): Promise<FocusSession[]> => {
  const db = await getDb();
  return db.select<FocusSession[]>(
    "SELECT * FROM focus_sessions WHERE kind='focus' ORDER BY id DESC LIMIT $1",
    [limit],
  );
};
