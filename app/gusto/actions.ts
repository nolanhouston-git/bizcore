"use server";

import { revalidatePath } from "next/cache";
import db from "@/lib/db";

const BUSINESS_ID = 1;

function makeBatchId() {
  return `gusto_sync_${Date.now()}`;
}

export async function connectGusto() {
  await new Promise(r => setTimeout(r, 1500));

  const existing = db.prepare(
    `SELECT id FROM gusto_connections WHERE business_id = ?`
  ).get(BUSINESS_ID);

  if (existing) {
    db.prepare(
      `UPDATE gusto_connections SET connected = 1 WHERE business_id = ?`
    ).run(BUSINESS_ID);
  } else {
    db.prepare(
      `INSERT INTO gusto_connections (business_id, connected) VALUES (?, 1)`
    ).run(BUSINESS_ID);
  }

  revalidatePath("/gusto");
  revalidatePath("/tax");
  return { error: null };
}

export async function disconnectGusto() {
  db.prepare(
    `UPDATE gusto_connections SET connected = 0 WHERE business_id = ?`
  ).run(BUSINESS_ID);

  revalidatePath("/gusto");
  revalidatePath("/tax");
  return { error: null };
}

export async function syncGusto() {
  const batchId = makeBatchId();
  const now = new Date().toISOString();

  // Simulated bi-weekly payroll — 2 runs per month, 3 months.
  // Member A: $75,000/yr = $2,884.62/bi-weekly
  // Member B: $3,000/yr  = $115.38/bi-weekly
  // Employer taxes: 7.65% FICA on each run + FUTA ($42/person) on first run of year only
  const simulatedRuns = [
    // January — Run 1 (FUTA applies: $42/person on first $7,000)
    {
      gusto_run_id: "gusto_run_2026_01a",
      pay_period_start: "2026-01-01", pay_period_end: "2026-01-15", pay_date: "2026-01-20",
      employees: [
        { name: "Member A", gross_pay: 2884.62, employee_taxes: 220.67, employer_taxes: 262.67, net_pay: 2663.95 },
        { name: "Member B", gross_pay:  115.38, employee_taxes:   8.83, employer_taxes:  50.83, net_pay:  106.55 },
      ],
    },
    // January — Run 2
    {
      gusto_run_id: "gusto_run_2026_01b",
      pay_period_start: "2026-01-16", pay_period_end: "2026-01-31", pay_date: "2026-02-05",
      employees: [
        { name: "Member A", gross_pay: 2884.62, employee_taxes: 220.67, employer_taxes: 220.67, net_pay: 2663.95 },
        { name: "Member B", gross_pay:  115.38, employee_taxes:   8.83, employer_taxes:   8.83, net_pay:  106.55 },
      ],
    },
    // February — Run 1
    {
      gusto_run_id: "gusto_run_2026_02a",
      pay_period_start: "2026-02-01", pay_period_end: "2026-02-14", pay_date: "2026-02-19",
      employees: [
        { name: "Member A", gross_pay: 2884.62, employee_taxes: 220.67, employer_taxes: 220.67, net_pay: 2663.95 },
        { name: "Member B", gross_pay:  115.38, employee_taxes:   8.83, employer_taxes:   8.83, net_pay:  106.55 },
      ],
    },
    // February — Run 2
    {
      gusto_run_id: "gusto_run_2026_02b",
      pay_period_start: "2026-02-15", pay_period_end: "2026-02-28", pay_date: "2026-03-05",
      employees: [
        { name: "Member A", gross_pay: 2884.62, employee_taxes: 220.67, employer_taxes: 220.67, net_pay: 2663.95 },
        { name: "Member B", gross_pay:  115.38, employee_taxes:   8.83, employer_taxes:   8.83, net_pay:  106.55 },
      ],
    },
    // March — Run 1
    {
      gusto_run_id: "gusto_run_2026_03a",
      pay_period_start: "2026-03-01", pay_period_end: "2026-03-15", pay_date: "2026-03-20",
      employees: [
        { name: "Member A", gross_pay: 2884.62, employee_taxes: 220.67, employer_taxes: 220.67, net_pay: 2663.95 },
        { name: "Member B", gross_pay:  115.38, employee_taxes:   8.83, employer_taxes:   8.83, net_pay:  106.55 },
      ],
    },
    // March — Run 2
    {
      gusto_run_id: "gusto_run_2026_03b",
      pay_period_start: "2026-03-16", pay_period_end: "2026-03-31", pay_date: "2026-04-05",
      employees: [
        { name: "Member A", gross_pay: 2884.62, employee_taxes: 220.67, employer_taxes: 220.67, net_pay: 2663.95 },
        { name: "Member B", gross_pay:  115.38, employee_taxes:   8.83, employer_taxes:   8.83, net_pay:  106.55 },
      ],
    },
  ];

  const insertRun = db.prepare(
    `INSERT INTO gusto_payroll_runs
     (business_id, gusto_run_id, sync_batch_id, pay_period_start, pay_period_end,
      pay_date, employee_name, gross_pay, employee_taxes, employer_taxes, net_pay, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const insertMany = db.transaction(() => {
    for (const run of simulatedRuns) {
      for (const emp of run.employees) {
        insertRun.run(
          BUSINESS_ID, run.gusto_run_id, batchId,
          run.pay_period_start, run.pay_period_end, run.pay_date,
          emp.name, emp.gross_pay, emp.employee_taxes, emp.employer_taxes, emp.net_pay,
          now
        );
      }
    }
  });
  insertMany();

  // Soft-delete previous gusto expense entries
  db.prepare(
    `UPDATE expenses SET deleted_at = datetime('now')
     WHERE business_id = ? AND source = 'gusto' AND deleted_at IS NULL`
  ).run(BUSINESS_ID);

  const insertExpense = db.prepare(
    `INSERT INTO expenses
     (business_id, date, description, amount, category, status, source, deleted_at)
     VALUES (?, ?, ?, ?, 'Payroll', 'approved', 'gusto', NULL)`
  );

  const insertExpenses = db.transaction(() => {
    for (const run of simulatedRuns) {
      const totalGross  = run.employees.reduce((s, e) => s + e.gross_pay, 0);
      const totalEmployer = run.employees.reduce((s, e) => s + e.employer_taxes, 0);
      const periodLabel = `${run.pay_period_start} – ${run.pay_period_end}`;
      insertExpense.run(BUSINESS_ID, run.pay_date, `Gusto Payroll — ${periodLabel}`, totalGross);
      insertExpense.run(BUSINESS_ID, run.pay_date, `Gusto Employer Taxes — ${periodLabel}`, totalEmployer);
    }
  });
  insertExpenses();

  db.prepare(
    `UPDATE gusto_connections SET last_synced = ?, synced_at = ? WHERE business_id = ?`
  ).run(now, now, BUSINESS_ID);

  revalidatePath("/gusto");
  revalidatePath("/expenses");
  revalidatePath("/tax");
  return { error: null };
}
