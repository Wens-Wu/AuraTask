import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { getDb } from "../db/database";

interface BackupPayload {
  schema_version: number;
  exported_at: string;
  app: "auratask";
  tasks: unknown[];
  focus_sessions: unknown[];
  daily_moods: unknown[];
  daily_notes: unknown[];
  habits: unknown[];
  habit_logs: unknown[];
  record_items: unknown[];
  record_logs: unknown[];
}

const SCHEMA_VERSION = 11;
const TABLES: { key: keyof Omit<BackupPayload, "schema_version" | "exported_at" | "app">; sql: string }[] = [
  { key: "tasks", sql: "SELECT * FROM tasks" },
  { key: "focus_sessions", sql: "SELECT * FROM focus_sessions" },
  { key: "daily_moods", sql: "SELECT * FROM daily_moods" },
  { key: "daily_notes", sql: "SELECT * FROM daily_notes" },
  { key: "habits", sql: "SELECT * FROM habits" },
  { key: "habit_logs", sql: "SELECT * FROM habit_logs" },
  { key: "record_items", sql: "SELECT * FROM record_items" },
  { key: "record_logs", sql: "SELECT * FROM record_logs" },
];

export async function exportBackup(): Promise<string | null> {
  const db = await getDb();
  const payload: BackupPayload = {
    schema_version: SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    app: "auratask",
    tasks: [],
    focus_sessions: [],
    daily_moods: [],
    daily_notes: [],
    habits: [],
    habit_logs: [],
    record_items: [],
    record_logs: [],
  };
  for (const t of TABLES) {
    payload[t.key] = await db.select<unknown[]>(t.sql);
  }

  const stamp = new Date()
    .toISOString()
    .replace(/[:T]/g, "-")
    .replace(/\..+$/, "");
  const defaultPath = `auratask-backup-${stamp}.json`;

  const path = await save({
    defaultPath,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!path) return null;

  await writeTextFile(path, JSON.stringify(payload, null, 2));
  return path;
}

export async function importBackup(): Promise<{ replaced: number } | null> {
  const path = await open({
    multiple: false,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!path || typeof path !== "string") return null;

  const text = await readTextFile(path);
  const data = JSON.parse(text) as BackupPayload;
  if (data.app !== "auratask") {
    throw new Error("文件不是 AuraTask 备份");
  }

  const db = await getDb();
  // Wipe in FK-safe order then refill
  await db.execute("DELETE FROM record_logs");
  await db.execute("DELETE FROM record_items");
  await db.execute("DELETE FROM habit_logs");
  await db.execute("DELETE FROM habits");
  await db.execute("DELETE FROM daily_moods");
  await db.execute("DELETE FROM daily_notes");
  await db.execute("DELETE FROM focus_sessions");
  await db.execute("DELETE FROM tasks");

  let count = 0;
  for (const row of data.tasks as any[]) {
    await db.execute(
      "INSERT INTO tasks (id, title, notes, subject, priority, due_date, completed_at, created_at, time_slot) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        row.id,
        row.title,
        row.notes ?? null,
        row.subject ?? null,
        row.priority ?? 1,
        row.due_date ?? null,
        row.completed_at ?? null,
        row.created_at,
        row.time_slot ?? null,
      ],
    );
    count++;
  }
  for (const row of data.focus_sessions as any[]) {
    await db.execute(
      "INSERT INTO focus_sessions (id, task_id, kind, duration_sec, session_date, started_at, ended_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [
        row.id,
        row.task_id ?? null,
        row.kind,
        row.duration_sec,
        row.session_date,
        row.started_at,
        row.ended_at,
      ],
    );
  }
  for (const row of data.daily_moods as any[]) {
    await db.execute(
      "INSERT INTO daily_moods (date, mood, score, updated_at) VALUES ($1,$2,$3,$4)",
      [row.date, row.mood, row.score, row.updated_at],
    );
  }
  for (const row of (data.daily_notes ?? []) as any[]) {
    await db.execute(
      "INSERT INTO daily_notes (date, text, updated_at) VALUES ($1,$2,$3)",
      [row.date, row.text, row.updated_at ?? new Date().toISOString()],
    );
  }
  for (const row of data.habits as any[]) {
    await db.execute(
      "INSERT INTO habits (id, name, emoji, kind, target_value, unit, schedule, archived_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        row.id,
        row.name,
        row.emoji,
        row.kind,
        row.target_value ?? null,
        row.unit ?? null,
        row.schedule ?? "daily",
        row.archived_at ?? null,
        row.created_at,
      ],
    );
  }
  for (const row of data.habit_logs as any[]) {
    await db.execute(
      "INSERT INTO habit_logs (habit_id, date, value, updated_at) VALUES ($1,$2,$3,$4)",
      [row.habit_id, row.date, row.value, row.updated_at],
    );
  }
  for (const row of (data.record_items ?? []) as any[]) {
    await db.execute(
      "INSERT INTO record_items (id, name, emoji, kind, unit, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [
        row.id,
        row.name,
        row.emoji,
        row.kind,
        row.unit ?? null,
        row.created_at ?? new Date().toISOString(),
      ],
    );
  }
  for (const row of (data.record_logs ?? []) as any[]) {
    await db.execute(
      "INSERT INTO record_logs (item_id, date, value, updated_at) VALUES ($1,$2,$3,$4)",
      [row.item_id, row.date, row.value, row.updated_at ?? new Date().toISOString()],
    );
  }
  return { replaced: count };
}
