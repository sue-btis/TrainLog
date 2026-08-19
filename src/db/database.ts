/**
 * The database handle (REQ-073).
 *
 * One process-wide instance. Repositories are plain functions over it, so a
 * caller never opens a database and no component or domain function can
 * (AGENTS.MD layering, AC-074).
 */

import { TrainLogDatabase } from '@/db/schema';

/** The application's database. Opened lazily by Dexie on first access. */
export const db = new TrainLogDatabase();

/**
 * Drops every row and reopens. For tests only — each test starts from an empty
 * database so state does not leak between them. It deletes the whole database
 * rather than clearing tables so the schema is re-created too.
 */
export async function resetDatabase(): Promise<void> {
  await db.delete();
  await db.open();
}
