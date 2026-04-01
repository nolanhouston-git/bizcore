import sqlite from "@/lib/db";
import { revalidatePath } from "next/cache";
import { type DateFormatKey } from "@/lib/dateFormat";
import ExpensesClient from "./ExpensesClient";

function getSetting(key: string, fallback: string): string {
  const row = sqlite.prepare(`SELECT value FROM settings WHERE business_id = 1 AND key = ?`).get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

type Expense = {
  id: number;
  date: string;
  description: string;
  merchant_name: string | null;
  amount: number;
  category: string;
  status: string;
  source: string;
};

async function addExpense(formData: FormData): Promise<{ id: number } | { error: string }> {
  "use server";

  const date        = formData.get("date") as string;
  const description = formData.get("description") as string;
  const merchant    = formData.get("merchant_name") as string;
  const amount      = parseFloat(formData.get("amount") as string);
  const category    = formData.get("category") as string;

  if (!date || !description || isNaN(amount)) return { error: "Missing required fields" };

  const result = sqlite.prepare(`
    INSERT INTO expenses (business_id, date, description, merchant_name, amount, category, status, source)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', 'manual')
  `).run(1, date, description, merchant || null, amount, category);

  revalidatePath("/expenses");
  return { id: Number(result.lastInsertRowid) };
}

async function deleteExpense(id: number) {
  "use server";
  sqlite.prepare(`
    UPDATE expenses SET deleted_at = datetime('now')
    WHERE id = ? AND business_id = 1
  `).run(id);
  revalidatePath("/expenses");
}

async function toggleLoanVisibility(formData: FormData) {
  "use server";
  const current = (sqlite.prepare(`SELECT value FROM settings WHERE business_id = 1 AND key = 'show_loan_transactions'`).get() as { value: string } | undefined)?.value ?? 'off';
  const next = current === 'on' ? 'off' : 'on';
  sqlite.prepare(`UPDATE settings SET value = ?, updated_at = datetime('now') WHERE business_id = 1 AND key = 'show_loan_transactions'`).run(next);
  revalidatePath("/expenses");
}

export default async function ExpensesPage() {
  const dateFormat = getSetting("date_format", "Mon DD, YYYY") as DateFormatKey;
  const showLoanTx = getSetting("show_loan_transactions", "off") === "on";

  const expenses = sqlite.prepare(`
    SELECT * FROM expenses
    WHERE business_id = 1
    AND deleted_at IS NULL
    AND (? OR category != 'Loan Transaction')
    ORDER BY date DESC, id DESC
  `).all(showLoanTx ? 1 : 0) as Expense[];

  const members = sqlite.prepare(`
    SELECT id, name FROM business_members
    WHERE business_id = 1 AND active = 1
    ORDER BY name ASC
  `).all() as { id: number; name: string }[];

  const total   = expenses.reduce((sum, e) => sum + e.amount, 0);
  const pending = expenses.filter(e => e.status === "pending").length;

  return (
    <div
      style={{ fontFamily: "'Outfit', sans-serif" }}
      className="p-10 text-[#e8edf5]"
    >
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#e8edf5]">Expenses</h1>
      </div>

      <div className="flex gap-4 mb-8 flex-wrap">
        {[
          { label: "Total Expenses", value: `$${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "text-[#4f8ef7]" },
          { label: "Transactions",   value: expenses.length,                                                     color: "text-[#a78bfa]" },
          { label: "Pending Review", value: pending,                                                             color: "text-[#e8b84b]" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#0f1420] border border-[#1e2535] rounded-2xl p-6 flex-1 min-w-[160px]">
            <p className="font-mono text-xs text-[#4a566e] uppercase tracking-widest mb-2">{label}</p>
            <p className={`font-mono text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <ExpensesClient
        expenses={expenses}
        members={members}
        showLoanTx={showLoanTx}
        dateFormat={dateFormat}
        addExpense={addExpense}
        deleteExpense={deleteExpense}
        toggleLoanVisibility={toggleLoanVisibility}
      />
    </div>
  );
}
