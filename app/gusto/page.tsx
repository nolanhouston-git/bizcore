import db from "@/lib/db";
import GustoClient from "./GustoClient";

const BUSINESS_ID = 1;

function getSetting(key: string, fallback: string): string {
  const row = db.prepare(`SELECT value FROM settings WHERE business_id = ? AND key = ?`).get(1, key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export default async function GustoPage() {
  const connection = db
    .prepare(`SELECT connected, last_synced FROM gusto_connections WHERE business_id = ?`)
    .get(BUSINESS_ID) as { connected: number; last_synced: string | null } | null;

  const latestBatch = db
    .prepare(
      `SELECT sync_batch_id FROM gusto_payroll_runs
       WHERE business_id = ?
       ORDER BY synced_at DESC LIMIT 1`
    )
    .get(BUSINESS_ID) as { sync_batch_id: string } | undefined;

  const rows = latestBatch
    ? (db
        .prepare(
          `SELECT gusto_run_id, pay_period_start, pay_period_end, pay_date,
                  employee_name, gross_pay, employee_taxes, employer_taxes, net_pay
           FROM gusto_payroll_runs
           WHERE business_id = ? AND sync_batch_id = ?
           ORDER BY pay_date DESC, employee_name ASC`
        )
        .all(BUSINESS_ID, latestBatch.sync_batch_id) as any[])
    : [];

  const dateFormat = getSetting("date_format", "Mon DD, YYYY");

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#e8edf5]" style={{ fontFamily: "'Outfit','DM Sans',sans-serif" }}>
          Gusto Payroll
        </h1>
        <p className="text-sm text-[#8896b0] mt-1">
          Payroll run history, YTD summaries, and Tax Advisor integration
        </p>
      </div>
      <GustoClient connection={connection} rows={rows} dateFormat={dateFormat} />
    </main>
  );
}
