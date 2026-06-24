import type {
  DailyMood,
  DailyNote,
  NewRecordItem,
  RecordItem,
  RecordLog,
} from "../types";
import { getDb } from "./client";

// ----- Daily mood -----

export const setMood = async (date: string, mood: string, score: number): Promise<void> => {
  const db = await getDb();
  await db.execute(
    "INSERT INTO daily_moods (date, mood, score, updated_at) VALUES ($1, $2, $3, datetime('now')) " +
      "ON CONFLICT(date) DO UPDATE SET mood=excluded.mood, score=excluded.score, updated_at=excluded.updated_at",
    [date, mood, score],
  );
};

export const clearMood = async (date: string): Promise<void> => {
  const db = await getDb();
  await db.execute("DELETE FROM daily_moods WHERE date = $1", [date]);
};

export const getMood = async (date: string): Promise<DailyMood | null> => {
  const db = await getDb();
  const rows = await db.select<DailyMood[]>("SELECT * FROM daily_moods WHERE date = $1", [
    date,
  ]);
  return rows[0] ?? null;
};

export const listMoodsInRange = async (
  startISO: string,
  endISO: string,
): Promise<DailyMood[]> => {
  const db = await getDb();
  return db.select<DailyMood[]>(
    "SELECT * FROM daily_moods WHERE date BETWEEN $1 AND $2 ORDER BY date ASC",
    [startISO, endISO],
  );
};

// ----- Daily note to self -----

export const getDailyNote = async (date: string): Promise<string | null> => {
  const db = await getDb();
  const rows = await db.select<DailyNote[]>(
    "SELECT date, text FROM daily_notes WHERE date = $1",
    [date],
  );
  return rows[0]?.text ?? null;
};

export const setDailyNote = async (date: string, text: string): Promise<void> => {
  const db = await getDb();
  const trimmed = text.trim();
  if (!trimmed) {
    await db.execute("DELETE FROM daily_notes WHERE date = $1", [date]);
    return;
  }
  await db.execute(
    "INSERT INTO daily_notes (date, text, updated_at) VALUES ($1, $2, datetime('now')) " +
      "ON CONFLICT(date) DO UPDATE SET text=excluded.text, updated_at=excluded.updated_at",
    [date, trimmed],
  );
};

/** Every day that has a 今日小目标, newest first — powers the goals timeline. */
export const listDailyNotes = async (): Promise<DailyNote[]> => {
  const db = await getDb();
  return db.select<DailyNote[]>(
    "SELECT date, text FROM daily_notes WHERE text <> '' ORDER BY date DESC",
  );
};

// ----- Standalone records -----

export const listRecordItems = async (): Promise<RecordItem[]> => {
  const db = await getDb();
  return db.select<RecordItem[]>("SELECT * FROM record_items ORDER BY id ASC");
};

export const createRecordItem = async (item: NewRecordItem): Promise<void> => {
  const db = await getDb();
  await db.execute(
    "INSERT INTO record_items (name, emoji, kind, unit) VALUES ($1, $2, $3, $4)",
    [item.name, item.emoji, item.kind, item.unit],
  );
};

export const updateRecordItem = async (
  id: number,
  item: NewRecordItem,
): Promise<void> => {
  const db = await getDb();
  await db.execute(
    "UPDATE record_items SET name=$1, emoji=$2, kind=$3, unit=$4 WHERE id=$5",
    [item.name, item.emoji, item.kind, item.unit, id],
  );
};

export const deleteRecordItem = async (id: number): Promise<void> => {
  const db = await getDb();
  await db.execute("DELETE FROM record_logs WHERE item_id=$1", [id]);
  await db.execute("DELETE FROM record_items WHERE id=$1", [id]);
};

export const listRecordLogs = async (
  startISO: string,
  endISO: string,
): Promise<RecordLog[]> => {
  const db = await getDb();
  return db.select<RecordLog[]>(
    "SELECT item_id, date, value, updated_at FROM record_logs " +
      "WHERE date BETWEEN $1 AND $2 ORDER BY date DESC, updated_at DESC",
    [startISO, endISO],
  );
};

export const listRecordLogsForItem = async (
  itemId: number,
  startISO: string,
  endISO: string,
): Promise<RecordLog[]> => {
  const db = await getDb();
  return db.select<RecordLog[]>(
    "SELECT item_id, date, value, updated_at FROM record_logs " +
      "WHERE item_id=$1 AND date BETWEEN $2 AND $3 ORDER BY date ASC",
    [itemId, startISO, endISO],
  );
};

export const upsertRecordLog = async (
  itemId: number,
  date: string,
  value: number,
): Promise<void> => {
  const db = await getDb();
  await db.execute(
    "INSERT INTO record_logs (item_id, date, value, updated_at) " +
      "VALUES ($1, $2, $3, datetime('now')) " +
      "ON CONFLICT(item_id, date) DO UPDATE SET " +
      "value=excluded.value, updated_at=excluded.updated_at",
    [itemId, date, value],
  );
};

export const clearRecordLog = async (itemId: number, date: string): Promise<void> => {
  const db = await getDb();
  await db.execute("DELETE FROM record_logs WHERE item_id=$1 AND date=$2", [
    itemId,
    date,
  ]);
};

/** The most recent date this record was logged, across all history (null if never). */
export const latestRecordLogDate = async (itemId: number): Promise<string | null> => {
  const db = await getDb();
  const rows = await db.select<{ d: string | null }[]>(
    "SELECT MAX(date) as d FROM record_logs WHERE item_id=$1",
    [itemId],
  );
  return rows[0]?.d ?? null;
};
