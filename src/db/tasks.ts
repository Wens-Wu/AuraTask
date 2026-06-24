import type { NewTask, Task } from "../types";
import { getDb } from "./client";

export const listTasksInRange = async (startISO: string, endISO: string): Promise<Task[]> => {
  const db = await getDb();
  return db.select<Task[]>(
    "SELECT * FROM tasks WHERE due_date IS NOT NULL AND due_date >= $1 AND due_date <= $2 ORDER BY due_date ASC, completed_at IS NOT NULL, position ASC, created_at ASC, id ASC",
    [startISO, endISO],
  );
};

export const listInboxTasks = async (): Promise<Task[]> => {
  const db = await getDb();
  return db.select<Task[]>(
    "SELECT * FROM tasks WHERE due_date IS NULL ORDER BY completed_at IS NOT NULL, position ASC, created_at ASC, id ASC",
  );
};

export const createTask = async (t: NewTask): Promise<void> => {
  const db = await getDb();
  const rows = await db.select<{ next_position: number }[]>(
    "SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM tasks WHERE (($1 IS NULL AND due_date IS NULL) OR due_date = $1)",
    [t.due_date],
  );
  const position = rows[0]?.next_position ?? 1;
  await db.execute(
    "INSERT INTO tasks (title, notes, subject, priority, due_date, time_slot, position, color) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [
      t.title,
      t.notes ?? null,
      t.subject ?? null,
      t.priority ?? 1,
      t.due_date,
      t.time_slot ?? null,
      position,
      t.color ?? null,
    ],
  );
};

export const toggleTask = async (id: number, done: boolean): Promise<void> => {
  const db = await getDb();
  await db.execute("UPDATE tasks SET completed_at = $1 WHERE id = $2", [
    done ? new Date().toISOString() : null,
    id,
  ]);
};

export const deleteTask = async (id: number): Promise<void> => {
  const db = await getDb();
  await db.execute("DELETE FROM tasks WHERE id = $1", [id]);
};

export const listOpenTasks = async (): Promise<Task[]> => {
  const db = await getDb();
  return db.select<Task[]>(
    "SELECT * FROM tasks WHERE completed_at IS NULL ORDER BY due_date IS NULL, due_date ASC, position ASC, created_at ASC, id ASC LIMIT 50",
  );
};

export const updateTask = async (id: number, patch: Partial<NewTask>): Promise<void> => {
  const db = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = $${i++}`);
    values.push(v);
  }
  if (!fields.length) return;
  values.push(id);
  await db.execute(`UPDATE tasks SET ${fields.join(", ")} WHERE id = $${i}`, values);
};

export const updateTaskPositions = async (taskIds: number[]): Promise<void> => {
  const db = await getDb();
  for (const [index, id] of taskIds.entries()) {
    await db.execute("UPDATE tasks SET position = $1 WHERE id = $2", [index + 1, id]);
  }
};
