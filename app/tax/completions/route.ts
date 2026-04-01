import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  const { deadlineId, period, taxYear, businessId } = await req.json();
  db.prepare(`
    INSERT OR IGNORE INTO tax_deadline_completions
      (business_id, deadline_id, tax_year, period)
    VALUES (?, ?, ?, ?)
  `).run(businessId, deadlineId, taxYear, period);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { deadlineId, period, taxYear, businessId } = await req.json();
  db.prepare(`
    DELETE FROM tax_deadline_completions
    WHERE business_id = ? AND deadline_id = ? AND tax_year = ? AND period = ?
  `).run(businessId, deadlineId, taxYear, period);
  return NextResponse.json({ ok: true });
}