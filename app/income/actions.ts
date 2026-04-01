"use server";

import sqlite from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function addIncome(formData: FormData): Promise<{ id: number } | { error: string }> {
  const date        = formData.get("date") as string;
  const description = formData.get("description") as string;
  const client      = formData.get("client_name") as string;
  const amount      = parseFloat(formData.get("amount") as string);
  const category    = formData.get("category") as string;

  if (!date || !description || isNaN(amount)) {
    return { error: "Date, description, and amount are required." };
  }

  const result = sqlite.prepare(`
    INSERT INTO income (business_id, date, description, merchant_name, amount, category, status, source)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', 'manual')
  `).run(1, date, description, client || null, amount, category);

  revalidatePath("/income");
  return { id: result.lastInsertRowid as number };
}

export async function deleteIncome(id: number): Promise<{ error: null }> {
  sqlite.prepare(`
    UPDATE income SET deleted_at = datetime('now')
    WHERE id = ? AND business_id = 1
  `).run(id);
  revalidatePath("/income");
  return { error: null };
}

export async function toggleLoanVisibility(): Promise<{ error: null }> {
  const current = (sqlite.prepare(
    `SELECT value FROM settings WHERE business_id = 1 AND key = 'show_loan_transactions'`
  ).get() as { value: string } | undefined)?.value ?? 'off';
  const next = current === 'on' ? 'off' : 'on';
  sqlite.prepare(
    `UPDATE settings SET value = ?, updated_at = datetime('now') WHERE business_id = 1 AND key = 'show_loan_transactions'`
  ).run(next);
  revalidatePath("/income");
  return { error: null };
}