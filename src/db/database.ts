// Barrel for the data layer. Queries live in domain modules (`db/tasks.ts`,
// `db/habits.ts`, …); this file re-exports them so callers can keep importing
// from `db/database`. Add new queries to the relevant domain module, not here.
export { getDb } from "./client";
export * from "./tasks";
export * from "./focus";
export * from "./stats";
export * from "./journal";
export * from "./habits";
