"use server";

import { revalidatePath } from "next/cache";
import db from "@/lib/db";

const BUSINESS_ID = 1;

export async function saveLayout(layout: any[]) {
  db.prepare(
    `INSERT INTO settings (business_id, key, value, updated_at)
     VALUES (?, 'dashboard_layout', ?, datetime('now'))
     ON CONFLICT(business_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(BUSINESS_ID, JSON.stringify(layout));

  revalidatePath("/");
  return { error: null };
}

export async function resetLayout() {
  db.prepare(
    `DELETE FROM settings WHERE business_id = ? AND key = 'dashboard_layout'`
  ).run(BUSINESS_ID);

  revalidatePath("/");
  return { error: null };
}
