import type { Habit, HabitLog, NewHabit } from "../types";
import { getDb } from "./client";

export const listActiveHabits = async (): Promise<Habit[]> => {
  const db = await getDb();
  return db.select<Habit[]>(
    "SELECT * FROM habits WHERE archived_at IS NULL ORDER BY id ASC",
  );
};

export const listAllHabits = async (): Promise<Habit[]> => {
  const db = await getDb();
  return db.select<Habit[]>("SELECT * FROM habits ORDER BY archived_at IS NOT NULL, id ASC");
};

export const createHabit = async (h: NewHabit): Promise<void> => {
  const db = await getDb();
  await db.execute(
    "INSERT INTO habits (name, emoji, kind, target_value, unit, schedule) VALUES ($1, $2, $3, $4, $5, $6)",
    [h.name, h.emoji, h.kind, h.target_value, h.unit, h.schedule],
  );
};

export const updateHabit = async (id: number, h: NewHabit): Promise<void> => {
  const db = await getDb();
  await db.execute(
    "UPDATE habits SET name=$1, emoji=$2, kind=$3, target_value=$4, unit=$5, schedule=$6 WHERE id=$7",
    [h.name, h.emoji, h.kind, h.target_value, h.unit, h.schedule, id],
  );
};

export const archiveHabit = async (id: number, archived: boolean): Promise<void> => {
  const db = await getDb();
  await db.execute("UPDATE habits SET archived_at=$1 WHERE id=$2", [
    archived ? new Date().toISOString() : null,
    id,
  ]);
};

export const deleteHabit = async (id: number): Promise<void> => {
  const db = await getDb();
  await db.execute("DELETE FROM habits WHERE id=$1", [id]);
};

export const upsertHabitLog = async (
  habit_id: number,
  date: string,
  value: number,
): Promise<void> => {
  const db = await getDb();
  await db.execute(
    "INSERT INTO habit_logs (habit_id, date, value, updated_at) VALUES ($1, $2, $3, datetime('now')) " +
      "ON CONFLICT(habit_id, date) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
    [habit_id, date, value],
  );
};

export const clearHabitLog = async (habit_id: number, date: string): Promise<void> => {
  const db = await getDb();
  await db.execute("DELETE FROM habit_logs WHERE habit_id=$1 AND date=$2", [habit_id, date]);
};

export const listHabitLogs = async (
  habit_id: number,
  startISO: string,
  endISO: string,
): Promise<HabitLog[]> => {
  const db = await getDb();
  return db.select<HabitLog[]>(
    "SELECT habit_id, date, value FROM habit_logs WHERE habit_id=$1 AND date BETWEEN $2 AND $3 ORDER BY date ASC",
    [habit_id, startISO, endISO],
  );
};

export const listAllLogsForDate = async (date: string): Promise<HabitLog[]> => {
  const db = await getDb();
  return db.select<HabitLog[]>(
    "SELECT habit_id, date, value FROM habit_logs WHERE date=$1",
    [date],
  );
};

export const listAllLogsInRange = async (
  startISO: string,
  endISO: string,
): Promise<HabitLog[]> => {
  const db = await getDb();
  return db.select<HabitLog[]>(
    "SELECT habit_id, date, value FROM habit_logs WHERE date BETWEEN $1 AND $2",
    [startISO, endISO],
  );
};
