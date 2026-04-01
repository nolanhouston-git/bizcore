// app/tax/page.tsx
import db from "@/lib/db";
import TaxClient from "./TaxClient";
import { type DateFormatKey } from "@/lib/dateFormat";

function getSetting(key: string, fallback: string): string {
  const row = db.prepare(`SELECT value FROM settings WHERE business_id = 1 AND key = ?`).get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type TaxRule = {
  rule_key: string;
  rule_value: string;
};

export type TaxBracket = {
  bracket_min: number;
  bracket_max: number | null;
  rate: number;
};

export type TaxDeadline = {
  id: number;
  entity_type: string;
  jurisdiction: string;
  form_name: string;
  description: string | null;
  recurrence: string;
  due_month: number | null;
  due_day: number | null;
  due_quarters: string | null;
  due_day_of_month: number | null;
  days_after_period_end: number;
  source_url: string | null;
};

export type DeadlineCompletion = {
  deadline_id: number;
  period: string;
};

export type ExpenseByCategory = {
  category: string;
  total: number;
};

export type BusinessMember = {
  id: number;
  name: string;
  ownership_pct: number;
  annual_salary: number;
  role: string;
};

// ── Data fetching ─────────────────────────────────────────────────────────────
export default async function TaxPage() {
  // Gross revenue: sum of all approved income records
  const incomeRow = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM income
       WHERE business_id = 1
         AND deleted_at IS NULL
         AND status = 'approved'`
    )
    .get() as { total: number };

  // Approved expenses grouped by category (excludes soft-deleted)
  const expensesByCategory = db
    .prepare(
      `SELECT category, SUM(amount) as total
       FROM expenses
       WHERE business_id = 1
         AND deleted_at IS NULL
         AND status = 'approved'
       GROUP BY category
       ORDER BY category`
    )
    .all() as ExpenseByCategory[];

  // Tax rules for S-Corp 2026
  const taxRulesRows = db
    .prepare(
      `SELECT rule_key, rule_value
       FROM tax_rules
       WHERE entity_type = 'scorp'
         AND tax_year = 2026`
    )
    .all() as TaxRule[];

  // Convert rules array to a key→value map for easy access in the client
  const taxRules: Record<string, number> = {};
  for (const row of taxRulesRows) {
    taxRules[row.rule_key] = parseFloat(row.rule_value);
  }

  // Tax brackets for MFJ 2026, ordered low to high
  const taxBrackets = db
    .prepare(
      `SELECT bracket_min, bracket_max, rate
       FROM tax_brackets
       WHERE filing_type = 'mfj'
         AND tax_year = 2026
       ORDER BY bracket_min`
    )
    .all() as TaxBracket[];

  // Active deadlines for this entity type
  const deadlines = db
    .prepare(
      `SELECT id, entity_type, jurisdiction, form_name, description,
              recurrence, due_month, due_day, due_quarters,
              due_day_of_month, days_after_period_end, source_url
       FROM tax_deadlines
       WHERE entity_type IN ('scorp', 'all')
         AND active = 1
       ORDER BY jurisdiction, form_name`
    )
    .all() as TaxDeadline[];

  // Completion records for business 1 in 2026
  const completions = db
    .prepare(
      `SELECT deadline_id, period
       FROM tax_deadline_completions
       WHERE business_id = 1
         AND tax_year = 2026`
    )
    .all() as DeadlineCompletion[];

  // Active members for this business
  const members = db
    .prepare(
      `SELECT id, name, ownership_pct, annual_salary, role
       FROM business_members
       WHERE business_id = 1
         AND active = 1
       ORDER BY ownership_pct DESC`
    )
    .all() as BusinessMember[];

  // Entity type for this business
  const businessRow = db
    .prepare(`SELECT entity_type FROM businesses WHERE id = 1`)
    .get() as { entity_type: string };

  const entityType = businessRow?.entity_type ?? "scorp";
  const dateFormat = getSetting("date_format", "Mon DD, YYYY") as DateFormatKey;

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif" }} className="p-10 text-[#e8edf5]">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#e8edf5]">Tax Advisor</h1>
      </div>
      <TaxClient
        grossRevenueFromDB={incomeRow.total}
        expensesByCategory={expensesByCategory}
        taxRules={taxRules}
        taxBrackets={taxBrackets}
        deadlines={deadlines}
        completions={completions}
        members={members}
        entityType={entityType}
        dateFormat={dateFormat}
      />
    </div>
  );
}