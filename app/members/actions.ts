"use server";

import { revalidatePath } from "next/cache";
import db from "@/lib/db";

const BUSINESS_ID = 1;

function getOwnershipSum(excludeId?: number): number {
  const rows = db
    .prepare(
      `SELECT ownership_pct FROM business_members
       WHERE business_id = ? AND active = 1 AND role IN ('owner','officer')
       ${excludeId ? "AND id != ?" : ""}`
    )
    .all(excludeId ? [BUSINESS_ID, excludeId] : [BUSINESS_ID]) as {
    ownership_pct: number;
  }[];
  return rows.reduce((sum, r) => sum + r.ownership_pct, 0);
}

export async function addMember(formData: FormData) {
  const name = (formData.get("name") as string).trim();
  const role = formData.get("role") as string;
  const ownership_pct = parseFloat(formData.get("ownership_pct") as string) || 0;
  const annual_salary = parseFloat(formData.get("annual_salary") as string) || 0;

  if (!name) return { error: "Name is required." };
  if (!["owner", "officer", "employee"].includes(role))
    return { error: "Invalid role." };

  if (role !== "employee") {
    const currentSum = getOwnershipSum();
    const newSum = currentSum + ownership_pct;
    if (newSum > 100.01) {
      return {
        error: `Ownership would total ${newSum.toFixed(2)}% — active owner/officer members must sum to 100%.`,
      };
    }
  }

  db.prepare(
    `INSERT INTO business_members (business_id, name, ownership_pct, annual_salary, role, active)
     VALUES (?, ?, ?, ?, ?, 1)`
  ).run(BUSINESS_ID, name, ownership_pct, annual_salary, role);

  revalidatePath("/members");
  revalidatePath("/tax");
  return { error: null };
}

export async function updateMember(id: number, formData: FormData) {
  const name = (formData.get("name") as string).trim();
  const role = formData.get("role") as string;
  const ownership_pct = parseFloat(formData.get("ownership_pct") as string) || 0;
  const annual_salary = parseFloat(formData.get("annual_salary") as string) || 0;

  if (!name) return { error: "Name is required." };
  if (!["owner", "officer", "employee"].includes(role))
    return { error: "Invalid role." };

  if (role !== "employee") {
    const currentSum = getOwnershipSum(id);
    const newSum = currentSum + ownership_pct;
    if (newSum > 100.01) {
      return {
        error: `Ownership would total ${newSum.toFixed(2)}% — active owner/officer members must sum to 100%.`,
      };
    }
  }

  db.prepare(
    `UPDATE business_members
     SET name = ?, role = ?, ownership_pct = ?, annual_salary = ?
     WHERE id = ? AND business_id = ?`
  ).run(name, role, ownership_pct, annual_salary, id, BUSINESS_ID);

  revalidatePath("/members");
  revalidatePath("/tax");
  return { error: null };
}

export async function deactivateMember(id: number) {
  db.prepare(
    `UPDATE business_members SET active = 0 WHERE id = ? AND business_id = ?`
  ).run(id, BUSINESS_ID);

  revalidatePath("/members");
  revalidatePath("/tax");
  return { error: null };
}

export async function reactivateMember(id: number) {
  db.prepare(
    `UPDATE business_members SET active = 1 WHERE id = ? AND business_id = ?`
  ).run(id, BUSINESS_ID);

  revalidatePath("/members");
  revalidatePath("/tax");
  return { error: null };
}
