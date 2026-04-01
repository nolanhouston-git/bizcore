import db from "@/lib/db";
import IncomeClient from "./IncomeClient";
import { type DateFormatKey } from "@/lib/dateFormat";

const BUSINESS_ID = 1;

function getSetting(key: string, fallback: string): string {
  const row = db.prepare(`SELECT value FROM settings WHERE business_id = ? AND key = ?`).get(BUSINESS_ID, key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

type Income = {
  id: number;
  date: string;
  description: string;
  merchant_name: string | null;
  amount: number;
  category: string;
  status: string;
  source: string;
  linked_loan_id: number | null;
};

type Member = { id: number; name: string };

export default async function IncomePage() {
  const dateFormat = getSetting("date_format", "Mon DD, YYYY") as DateFormatKey;
  const showLoanTx = getSetting("show_loan_transactions", "off") === "on";

  const records = db.prepare(`
    SELECT id, date, description, merchant_name, amount, category, status, source, linked_loan_id
    FROM income
    WHERE business_id = ?
      AND deleted_at IS NULL
      AND (? = 1 OR category != 'Loan Transaction')
    ORDER BY date DESC, id DESC
  `).all(BUSINESS_ID, showLoanTx ? 1 : 0) as Income[];

  const members = db.prepare(`
    SELECT id, name FROM business_members
    WHERE business_id = ? AND active = 1
    ORDER BY name ASC
  `).all(BUSINESS_ID) as Member[];

  const total    = records.reduce((sum, r) => sum + r.amount, 0);
  const pending  = records.filter(r => r.status === "pending").length;
  const approved = records.filter(r => r.status === "approved").length;

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif" }} className="p-10 text-[#e8edf5]">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#e8edf5]">Income</h1>
      </div>

      <div className="flex gap-4 mb-8 flex-wrap">
        {[
          { label: "Total Income",   value: `$${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "text-[#34d399]" },
          { label: "Approved",       value: approved,                                                           color: "text-[#34d399]" },
          { label: "Pending Review", value: pending,                                                            color: "text-[#e8b84b]" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#0f1420] border border-[#1e2535] rounded-2xl p-6 flex-1 min-w-[160px]">
            <p className="font-mono text-xs text-[#4a566e] uppercase tracking-widest mb-2">{label}</p>
            <p className={`font-mono text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <IncomeClient
        records={records}
        members={members}
        showLoanTx={showLoanTx}
        dateFormat={dateFormat}
      />
    </div>
  );
}