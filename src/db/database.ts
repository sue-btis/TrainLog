import { TrainLogDatabase } from '@/db/schema';

export const db = new TrainLogDatabase();

export async function resetDatabase(): Promise<void> {
  await db.delete();
  await db.open();
}
