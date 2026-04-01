import sqlite from "@/lib/db";
import { formatDateTime } from "@/lib/dateFormat";
import CashflowClient from "./CashflowClient";

const BUSINESS_ID = 1;

function getSetting(key: string): string {
  const row = sqlite.prepare(`
    SELECT value FROM settings WHERE business_id = ? AND key = ?
  `).get(BUSINESS_ID, key) as { value: string } | undefined;
  return row?.value ?? "";
}

export default async function CashflowPage() {
  // ── Settings ──────────────────────────────────────────────────────────────
  const currentCash      = parseFloat(getSetting("current_cash_manual") || "0");
  const cachedAt         = getSetting("current_cash_cached_at");
  const operatingReserve = parseFloat(getSetting("operating_reserve") || "5000");

  // ── Members ───────────────────────────────────────────────────────────────
  const members = sqlite.prepare(`
    SELECT name, ownership_pct, annual_salary
    FROM business_members
    WHERE business_id = ? AND active = 1
    ORDER BY ownership_pct DESC
  `).all(BUSINESS_ID) as { name: string; ownership_pct: number; annual_salary: number }[];

  // ── Projected 60-day Expenses ─────────────────────────────────────────────
  // Average monthly approved non-payroll expenses over last 90 days, times 2
  const expenseRow = sqlite.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM expenses
    WHERE business_id = ?
      AND status = 'approved'
      AND category != 'Payroll'
      AND deleted_at IS NULL
      AND date >= date('now', '-90 days')
  `).get(BUSINESS_ID) as { total: number };

  const avgMonthlyExpenses = expenseRow.total / 3;
  const projected60Day     = avgMonthlyExpenses * 2;

  // ── Next Tax Payment ──────────────────────────────────────────────────────
  // Placeholder — no dollar amounts on tax deadlines yet (Session 12)
  const nextTaxPayment = 0;

  // ── Loan Repayments Due (next 60 days) ───────────────────────────────────
  // Sum scheduled payment_amount for all active loans that have a payment_amount set.
  // These represent known upcoming obligations that reduce safe distribution amount.
  const loanRepaymentRows = sqlite.prepare(`
    SELECT COALESCE(SUM(payment_amount), 0) as total
    FROM loans
    WHERE business_id = ?
      AND deleted_at IS NULL
      AND payment_amount IS NOT NULL
  `).get(BUSINESS_ID) as { total: number };
  const loanRepaymentsNext60Days = loanRepaymentRows.total;

  // ── Safe Distribution Calculation ─────────────────────────────────────────
  const safeDistribution = currentCash - nextTaxPayment - projected60Day - operatingReserve - loanRepaymentsNext60Days;

  // ── Color Indicator ───────────────────────────────────────────────────────
  const indicator: "green" | "amber" | "red" =
    safeDistribution > 2000 ? "green" :
    safeDistribution >= 0   ? "amber" : "red";

  // ── Per-Member Split ──────────────────────────────────────────────────────
  const memberSplits = members.map(m => ({
    name:         m.name,
    ownership_pct: m.ownership_pct,
    amount:       Math.max(0, safeDistribution) * (m.ownership_pct / 100),
  }));

// ── Distribution History — sourced from expenses table ────────────────────
  const distributions = sqlite.prepare(`
    SELECT id, date, description, amount, source, created_at
    FROM expenses
    WHERE business_id = ? AND category = 'Distributions' AND deleted_at IS NULL
    ORDER BY date DESC
  `).all(BUSINESS_ID) as {
    id: number;
    date: string;
    description: string;
    amount: number;
    source: string;
    created_at: string;
  }[];

  // ── Date format for display ───────────────────────────────────────────────
  const dateFormatRow = sqlite.prepare(`
    SELECT value FROM settings WHERE business_id = ? AND key = 'date_format'
  `).get(BUSINESS_ID) as { value: string } | undefined;
  const dateFormat = dateFormatRow?.value ?? "Mon DD, YYYY";

  return (
    <CashflowClient
      currentCash={currentCash}
      cachedAt={cachedAt}
      operatingReserve={operatingReserve}
      projected60Day={projected60Day}
      avgMonthlyExpenses={avgMonthlyExpenses}
      nextTaxPayment={nextTaxPayment}
      safeDistribution={safeDistribution}
      indicator={indicator}
      memberSplits={memberSplits}
      distributions={distributions}
      dateFormat={dateFormat}
      loanRepaymentsNext60Days={loanRepaymentsNext60Days}
    />
  );
}