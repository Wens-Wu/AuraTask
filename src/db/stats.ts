import type { DayMetric, SubjectMetric } from "../types";
import { getDb } from "./client";

export const dailyMetricsInRange = async (
  startISO: string,
  endISO: string,
): Promise<DayMetric[]> => {
  const db = await getDb();
  const focusRows = await db.select<{ d: string; mins: number }[]>(
    "SELECT session_date as d, COALESCE(SUM(duration_sec),0)/60 as mins FROM focus_sessions WHERE kind='focus' AND session_date BETWEEN $1 AND $2 GROUP BY session_date",
    [startISO, endISO],
  );
  const taskRows = await db.select<{ d: string; planned: number; done: number }[]>(
    "SELECT due_date as d, COUNT(*) as planned, SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as done FROM tasks WHERE due_date BETWEEN $1 AND $2 GROUP BY due_date",
    [startISO, endISO],
  );
  const map = new Map<string, DayMetric>();
  for (const r of focusRows) {
    map.set(r.d, { date: r.d, focus_min: r.mins, done: 0, planned: 0 });
  }
  for (const r of taskRows) {
    const ex = map.get(r.d) ?? { date: r.d, focus_min: 0, done: 0, planned: 0 };
    ex.planned = r.planned;
    ex.done = r.done;
    map.set(r.d, ex);
  }
  return Array.from(map.values());
};

export const subjectBreakdown = async (
  startISO: string,
  endISO: string,
): Promise<SubjectMetric[]> => {
  const db = await getDb();
  return db.select<SubjectMetric[]>(
    `SELECT COALESCE(t.subject, '未分类') as subject,
            COALESCE(SUM(f.duration_sec),0)/60 as focus_min,
            COUNT(DISTINCT t.id) as task_count
     FROM tasks t
     LEFT JOIN focus_sessions f ON f.task_id = t.id AND f.kind='focus'
     WHERE t.due_date BETWEEN $1 AND $2
     GROUP BY COALESCE(t.subject, '未分类')
     ORDER BY focus_min DESC, task_count DESC`,
    [startISO, endISO],
  );
};
