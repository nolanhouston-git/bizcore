"use server";

import { revalidatePath } from "next/cache";
import db from "@/lib/db";

const BUSINESS_ID = 1;

export async function updateSetting(key: string, value: string) {
  db.prepare(
    `INSERT INTO settings (business_id, key, value, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(business_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(BUSINESS_ID, key, value);

  // Revalidate every page so the new format takes effect everywhere
  revalidatePath("/", "layout");
  return { error: null };
}
