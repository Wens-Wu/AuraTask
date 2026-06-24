import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

/**
 * Shared lazy handle to the SQLite database. Every domain module in `db/`
 * goes through this so there is a single connection across the app.
 */
export const getDb = () => {
  if (!dbPromise) dbPromise = Database.load("sqlite:auratask.db");
  return dbPromise;
};
