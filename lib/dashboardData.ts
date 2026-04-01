// Dashboard data fetching — all server-side, called once in app/page.tsx.
// Every widget receives a slice of DashboardData as props.
// To add data for a new widget: add a field here and populate it below.

import db from "@/lib/db";
import { refreshPlaidBalance } from "@/lib/plaid";

const BUSINESS_ID = 1;
const CURRENT_YEAR = new Date().getFullYear();

export type TaxDeadline = {
  id: number;
  form_name: string;
  description: string;
  jurisdiction: string;
  due_date: string;
  days_remaining: number;
};

export type MemberDistribution = {
  name: string;
  ownership_pct: number;
  distribution: number;
};

export type MonthlyDataPoint = {
  month: string;  // "2026-01"
  label: string;  // "Jan"
  income: number;
  expenses: number;
  net: number;
};

export type CategoryDataPoint = {
  category: string;
  amount: number;
};

export type DashboardData = {
  // Metrics
  ytdRevenue: number;
  ytdExpenses: number;
  netIncome: number;
  pendingExpenses: number;
  pendingIncome: number;
  cashRunway: number | null;       // months, null if no balance data
  cashBalance: number | null;      // raw balance from Plaid cache
  avgMonthlyBurn: number;

  // Tax
  upcomingDeadlines: TaxDeadline[];
  scCorpNetIncome: number;
  totalSalaries: number;
  totalEmployerTax: number;
  distributions: MemberDistribution[];

  // Charts
  monthlyData: MonthlyDataPoint[];         // last 12 months
  spendingByCategory: CategoryDataPoint[];
  revenueByCategory: CategoryDataPoint[];

  // System
  bankConnected: boolean;
  gustoConnected: boolean;
  lastBankSync: string | null;
  lastGustoSync: string | null;

  // Business
  businessName: string;
  businessDba: string;
};

function getUpcomingDeadlines(): TaxDeadline[] {
  const deadlines = db.prepare(
    `SELECT id, form_name, description, jurisdiction,
            due_month, due_day, recurrence, due_quarters, due_day_of_month, days_after_period_end
     FROM tax_deadlines WHERE active = 1`
  ).all() as any[];

  const today = new Date();
  const results: TaxDeadline[] = [];

  for (const d of deadlines) {
    // Generate next due date based on recurrence pattern
    let dueDate: Date | null = null;

    if (d.recurrence === "annual" && d.due_month && d.due_day) {
      dueDate = new Date(today.getFullYear(), d.due_month - 1, d.due_day);
      if (dueDate < today) dueDate.setFullYear(dueDate.getFullYear() + 1);
    } else if (d.recurrence === "quarterly" && d.due_quarters) {
      // due_quarters is [1,2,3,4] — map quarter numbers to actual due dates
      // Form 941: Q1 Apr 30, Q2 Jul 31, Q3 Oct 31, Q4 Jan 31
      const QUARTER_DATES: Record<number, { month: number; day: number }> = {
        1: { month: 4,  day: 30 },
        2: { month: 7,  day: 31 },
        3: { month: 10, day: 31 },
        4: { month: 1,  day: 31 },
      };
      const quarters: number[] = JSON.parse(d.due_quarters);
      const upcoming = quarters
        .map((q: number) => {
          const qd = QUARTER_DATES[q];
          if (!qd) return null;
          // Q4 due Jan 31 of next year
          const year = q === 4 ? today.getFullYear() + 1 : today.getFullYear();
          return new Date(year, qd.month - 1, qd.day);
        })
        .filter((dt): dt is Date => dt !== null && dt >= today)
        .sort((a: Date, b: Date) => a.getTime() - b.getTime());
      if (upcoming.length === 0) {
        // All this year passed — next is Q1 of next year
        dueDate = new Date(today.getFullYear() + 1, 3, 30);
      } else {
        dueDate = upcoming[0];
      }
    } else if (d.recurrence === "monthly" && d.due_day_of_month) {
      // Due on the 25th of the following month
      dueDate = new Date(today.getFullYear(), today.getMonth() + 1, d.due_day_of_month);
      if (dueDate < today) dueDate = new Date(today.getFullYear(), today.getMonth() + 2, d.due_day_of_month);
    }

    if (!dueDate) continue;

    const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysRemaining > 90) continue; // only show within 90 days

    results.push({
      id: d.id,
      form_name: d.form_name,
      description: d.description,
      jurisdiction: d.jurisdiction,
      due_date: dueDate.toISOString().slice(0, 10),
      days_remaining: daysRemaining,
    });
  }

  return results.sort((a, b) => a.days_remaining - b.days_remaining).slice(0, 3);
}

function getMonthlyData(): MonthlyDataPoint[] {
  const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const points: MonthlyDataPoint[] = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const year  = d.getFullYear();
    const month = d.getMonth() + 1;
    const key   = `${year}-${String(month).padStart(2, "0")}`;

    const income = (db.prepare(
      `SELECT COALESCE(SUM(amount),0) as total FROM income
       WHERE business_id = ? AND status = 'approved' AND deleted_at IS NULL
       AND strftime('%Y-%m', date) = ?`
    ).get(BUSINESS_ID, key) as { total: number }).total;

    const expenses = (db.prepare(
      `SELECT COALESCE(SUM(amount),0) as total FROM expenses
       WHERE business_id = ? AND status = 'approved' AND deleted_at IS NULL
       AND strftime('%Y-%m', date) = ?`
    ).get(BUSINESS_ID, key) as { total: number }).total;

    points.push({
      month: key,
      label: `${MONTH_LABELS[month - 1]} ${year !== new Date().getFullYear() ? year : ""}`.trim(),
      income,
      expenses,
      net: income - expenses,
    });
  }

  return points;
}

export async function getDashboardData(): Promise<DashboardData> {
  const yearStr = String(CURRENT_YEAR);

  // YTD figures
  const ytdRevenue = (db.prepare(
    `SELECT COALESCE(SUM(amount),0) as total FROM income
     WHERE business_id = ? AND status = 'approved' AND deleted_at IS NULL
     AND strftime('%Y', date) = ?`
  ).get(BUSINESS_ID, yearStr) as { total: number }).total;

  const ytdExpenses = (db.prepare(
    `SELECT COALESCE(SUM(amount),0) as total FROM expenses
     WHERE business_id = ? AND status = 'approved' AND deleted_at IS NULL
     AND strftime('%Y', date) = ?`
  ).get(BUSINESS_ID, yearStr) as { total: number }).total;

  const pendingExpenses = (db.prepare(
    `SELECT COUNT(*) as count FROM expenses
     WHERE business_id = ? AND status IN ('pending','imported') AND deleted_at IS NULL`
  ).get(BUSINESS_ID) as { count: number }).count;

  const pendingIncome = (db.prepare(
    `SELECT COUNT(*) as count FROM income
     WHERE business_id = ? AND status = 'pending' AND deleted_at IS NULL`
  ).get(BUSINESS_ID) as { count: number }).count;

  // Cash runway — avg monthly burn from last 3 months of approved expenses
  const avgBurnRow = db.prepare(
    `SELECT COALESCE(AVG(monthly_total),0) as avg_burn FROM (
       SELECT strftime('%Y-%m', date) as month, SUM(amount) as monthly_total
       FROM expenses
       WHERE business_id = ? AND status = 'approved' AND deleted_at IS NULL
       AND date >= date('now', '-3 months')
       GROUP BY month
     )`
  ).get(BUSINESS_ID) as { avg_burn: number };
  const avgMonthlyBurn = avgBurnRow.avg_burn;

  // Plaid balance — fetch live on every dashboard load, cache in settings
  const plaidConn = db.prepare(
    `SELECT connected_at FROM plaid_connections WHERE business_id = ? LIMIT 1`
  ).get(BUSINESS_ID) as { connected_at: string } | undefined;
  const bankConnected = !!plaidConn;

  if (bankConnected) {
    try {
      await refreshPlaidBalance();
    } catch {
      // Non-fatal — fall through to cached value below
    }
  }

  const cashBalanceRow = db.prepare(
    `SELECT value FROM settings WHERE business_id = ? AND key = 'current_cash_manual'`
  ).get(BUSINESS_ID) as { value: string } | undefined;
  const cashBalance = cashBalanceRow?.value ? parseFloat(cashBalanceRow.value) : null;
  const cashRunway = cashBalance && avgMonthlyBurn > 0
    ? cashBalance / avgMonthlyBurn
    : null;

  // S-Corp calculations
  const members = db.prepare(
    `SELECT name, ownership_pct, annual_salary FROM business_members
     WHERE business_id = ? AND active = 1 AND role IN ('owner','officer')`
  ).all(BUSINESS_ID) as { name: string; ownership_pct: number; annual_salary: number }[];

  const totalSalaries    = members.reduce((s, m) => s + m.annual_salary, 0);
  const totalEmployerTax = totalSalaries * 0.0765;
  const scCorpNetIncome  = ytdRevenue - totalSalaries - totalEmployerTax - ytdExpenses;

  const distributions: MemberDistribution[] = members.map(m => ({
    name: m.name,
    ownership_pct: m.ownership_pct,
    distribution: Math.max(0, scCorpNetIncome * (m.ownership_pct / 100)),
  }));

  // Charts
  const spendingByCategory = db.prepare(
    `SELECT category, COALESCE(SUM(amount),0) as amount FROM expenses
     WHERE business_id = ? AND status = 'approved' AND deleted_at IS NULL
     AND strftime('%Y', date) = ?
     GROUP BY category ORDER BY amount DESC`
  ).all(BUSINESS_ID, yearStr) as CategoryDataPoint[];

  const revenueByCategory = db.prepare(
    `SELECT category, COALESCE(SUM(amount),0) as amount FROM income
     WHERE business_id = ? AND status = 'approved' AND deleted_at IS NULL
     AND strftime('%Y', date) = ?
     GROUP BY category ORDER BY amount DESC`
  ).all(BUSINESS_ID, yearStr) as CategoryDataPoint[];

  // Gusto
  const gustoConn = db.prepare(
    `SELECT connected, last_synced FROM gusto_connections WHERE business_id = ?`
  ).get(BUSINESS_ID) as { connected: number; last_synced: string | null } | undefined;

  // Business
  const biz = db.prepare(
    `SELECT name, dba FROM businesses WHERE id = ?`
  ).get(BUSINESS_ID) as { name: string; dba: string } | undefined;

  // Upcoming deadlines
  const upcomingDeadlines = getUpcomingDeadlines();

  return {
    ytdRevenue,
    ytdExpenses,
    netIncome: ytdRevenue - ytdExpenses,
    pendingExpenses,
    pendingIncome,
    cashRunway,
    avgMonthlyBurn,
    cashBalance,
    upcomingDeadlines,
    scCorpNetIncome,
    totalSalaries,
    totalEmployerTax,
    distributions,
    monthlyData: getMonthlyData(),
    spendingByCategory,
    revenueByCategory,
    bankConnected,
    gustoConnected: gustoConn?.connected === 1,
    lastBankSync: plaidConn?.connected_at ?? null,
    lastGustoSync: gustoConn?.last_synced ?? null,
    businessName: biz?.name ?? "",
    businessDba:  biz?.dba ?? "",
  };
}
