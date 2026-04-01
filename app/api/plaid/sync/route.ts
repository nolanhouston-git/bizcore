import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import sqlite from "@/lib/db";

const INCOME_CATEGORIES = ["Consulting", "Research Project", "Retainer", "Product", "Reimbursement", "Other Income"];

// Simple heuristic to guess income category from transaction name
function guessIncomeCategory(name: string): string {
  const text = name.toLowerCase();
  if (text.includes("retainer"))                                    return "Retainer";
  if (text.includes("research") || text.includes("study"))         return "Research Project";
  if (text.includes("consult"))                                     return "Consulting";
  if (text.includes("reimburse") || text.includes("reimbursement")) return "Reimbursement";
  return "Other Income";
}

// Simple heuristic to guess expense category from transaction name
function guessExpenseCategory(name: string): string {
  const text = name.toLowerCase();
  if (text.includes("payroll") || text.includes("gusto") || text.includes("adp"))           return "Payroll";
  if (text.includes("rent") || text.includes("lease"))                                       return "Rent";
  if (text.includes("electric") || text.includes("gas") || text.includes("water") ||
      text.includes("internet") || text.includes("comcast") || text.includes("at&t"))        return "Utilities";
  if (text.includes("amazon") || text.includes("staples") || text.includes("supplies"))      return "Supplies";
  if (text.includes("google ads") || text.includes("facebook") || text.includes("meta"))     return "Marketing";
  if (text.includes("adobe") || text.includes("slack") || text.includes("zoom") ||
      text.includes("aws") || text.includes("github") || text.includes("software"))          return "Software";
  if (text.includes("airline") || text.includes("hotel") || text.includes("uber") ||
      text.includes("airbnb") || text.includes("flight"))                                    return "Travel";
  if (text.includes("survey") || text.includes("qualtrics") || text.includes("respondent")) return "Research";
  if (text.includes("attorney") || text.includes("cpa") || text.includes("legal"))          return "Professional Services";
  if (text.includes("bank") || text.includes("fee") || text.includes("wire"))               return "Banking";
  if (text.includes("distribution") || text.includes("member draw") || text.includes("owner draw")) return "Distributions";
  return "Other";
}

export async function POST() {
  try {
    // Get connection from database
    const connection = sqlite.prepare(`
      SELECT * FROM plaid_connections WHERE business_id = 1 LIMIT 1
    `).get() as { access_token: string; cursor: string | null; id: number } | undefined;

    if (!connection) {
      return NextResponse.json({ error: "No bank connected" }, { status: 400 });
    }

    const accessToken = connection.access_token;
    let cursor        = connection.cursor || undefined;
    let added         = 0;
    let hasMore       = true;

    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor,
      });

      const { added: newTransactions, next_cursor, has_more } = response.data;

      for (const tx of newTransactions) {
        // Check if already imported (handles soft-deleted transactions too)
        const existing = sqlite.prepare(`
          SELECT id FROM expenses WHERE plaid_transaction_id = ?
          UNION
          SELECT id FROM income WHERE plaid_transaction_id = ?
        `).get(tx.transaction_id, tx.transaction_id);

        if (existing) continue;

        const isCredit = tx.amount < 0; // Plaid uses negative for credits
        const amount   = Math.abs(tx.amount);
        const date     = tx.date;
        const desc     = tx.name;
        const merchant = tx.merchant_name || null;

        if (isCredit) {
          // Money coming in → income ledger
          sqlite.prepare(`
            INSERT INTO income (business_id, date, description, merchant_name, amount, category, status, source, plaid_transaction_id)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', 'bank', ?)
          `).run(1, date, desc, merchant, amount, guessIncomeCategory(desc), tx.transaction_id);
        } else {
          // Money going out → expenses ledger
          sqlite.prepare(`
            INSERT INTO expenses (business_id, date, description, merchant_name, amount, category, status, source, plaid_transaction_id)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', 'bank', ?)
          `).run(1, date, desc, merchant, amount, guessExpenseCategory(desc), tx.transaction_id);
        }

        added++;
      }

      cursor  = next_cursor;
      hasMore = has_more;
    }

    // Save updated cursor
    sqlite.prepare(`
      UPDATE plaid_connections
      SET cursor = ?, last_synced = datetime('now')
      WHERE business_id = 1
    `).run(cursor);

    return NextResponse.json({ success: true, imported: added });
  } catch (error) {
    console.error("Plaid sync error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}