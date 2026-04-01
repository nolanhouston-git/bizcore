"use server";

import sqlite from "@/lib/db";
import { revalidatePath } from "next/cache";

const BUSINESS_ID = 1;

export async function recordManualDistribution(formData: FormData) {
  const date        = formData.get("distribution_date") as string;
  const amount      = parseFloat(formData.get("total_amount") as string);
  const description = (formData.get("description") as string) || "Manual Distribution";

  if (!date || isNaN(amount) || amount <= 0) {
    return { error: "Date and a valid amount are required." };
  }

  sqlite.prepare(`
    INSERT INTO expenses (business_id, date, description, amount, category, status, source)
    VALUES (?, ?, ?, ?, 'Distributions', 'approved', 'manual')
  `).run(BUSINESS_ID, date, description, amount);

  revalidatePath("/cashflow");
  return { error: null };
}

export async function updateDistributionDescription(id: number, description: string) {
  if (!description.trim()) {
    return { error: "Description cannot be empty." };
  }

  sqlite.prepare(`
    UPDATE expenses SET description = ?
    WHERE id = ? AND business_id = ? AND category = 'Distributions'
  `).run(description.trim(), id, BUSINESS_ID);

  revalidatePath("/cashflow");
  return { error: null };
}

export async function deleteDistribution(id: number) {
  sqlite.prepare(`
    UPDATE expenses SET deleted_at = datetime('now')
    WHERE id = ? AND business_id = ? AND category = 'Distributions'
  `).run(id, BUSINESS_ID);

  revalidatePath("/cashflow");
  return { error: null };
}

export async function updateOperatingReserve(formData: FormData) {
  const value = parseFloat(formData.get("operating_reserve") as string);

  if (isNaN(value) || value < 0) {
    return { error: "Reserve must be a valid positive number." };
  }

  sqlite.prepare(`
    UPDATE settings SET value = ?, updated_at = datetime('now')
    WHERE business_id = ? AND key = 'operating_reserve'
  `).run(value.toString(), BUSINESS_ID);

  revalidatePath("/cashflow");
  return { error: null };
}