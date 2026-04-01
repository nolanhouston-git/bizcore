import sqlite from "@/lib/db";
import BankConnection from "./BankConnection";
import AccountsList from "./AccountsList";
import { formatDate, type DateFormatKey } from "@/lib/dateFormat";

function getSetting(key: string, fallback: string): string {
  const row = sqlite.prepare(`SELECT value FROM settings WHERE business_id = 1 AND key = ?`).get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

type Connection = {
  institution_name: string | null;
  connected_at: string;
  last_synced: string | null;
};

type Transaction = {
  id: number;
  date: string;
  description: string;
  merchant_name: string | null;
  amount: number;
  category: string;
  status: string;
};

export default async function BankPage() {
  const dateFormat = getSetting("date_format", "Mon DD, YYYY") as DateFormatKey;

  const connection = sqlite.prepare(`
    SELECT * FROM plaid_connections WHERE business_id = 1 LIMIT 1
  `).get() as Connection | undefined;

  const recentExpenses = sqlite.prepare(`
    SELECT * FROM expenses
    WHERE business_id = 1
    AND source = 'bank'
    AND deleted_at IS NULL
    ORDER BY date DESC, id DESC
    LIMIT 10
  `).all() as Transaction[];

  const recentIncome = sqlite.prepare(`
    SELECT * FROM income
    WHERE business_id = 1
    AND source = 'bank'
    AND deleted_at IS NULL
    ORDER BY date DESC, id DESC
    LIMIT 10
  `).all() as Transaction[];

  return (
    <div
      style={{ fontFamily: "'Outfit', sans-serif" }}
      className="p-10 text-[#e8edf5]"
    >
      {/* Page title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#e8edf5]">Bank Connection & Accounts</h1>
      </div>

      {/* Connection card — client component handles all interactivity */}
      <BankConnection
        connected={!!connection}
        institutionName={connection?.institution_name ?? null}
        connectedAt={connection?.connected_at ?? null}
        lastSynced={connection?.last_synced ?? null}
        dateFormat={dateFormat}
      />

      {connection && <AccountsList />}

      {/* Recent transactions */}
      {connection && (recentExpenses.length > 0 || recentIncome.length > 0) && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-[#0f1420] border border-[#1e2535] rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-[#1e2535]">
              <p className="font-mono text-xs text-[#4a566e] uppercase tracking-widest">
                Recent Bank Expenses
              </p>
            </div>
            <table className="w-full border-collapse">
              <tbody>
                {recentExpenses.map(e => (
                  <tr key={e.id} className="border-b border-[#1e2535]/50">
                    <td className="p-3 font-mono text-xs text-[#4a566e]">{formatDate(e.date, dateFormat)}</td>
                    <td className="p-3 text-sm text-[#e8edf5]">{e.merchant_name || e.description}</td>
                    <td className="p-3 font-mono text-sm text-[#4f8ef7] text-right">${e.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-[#0f1420] border border-[#1e2535] rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-[#1e2535]">
              <p className="font-mono text-xs text-[#4a566e] uppercase tracking-widest">
                Recent Bank Income
              </p>
            </div>
            <table className="w-full border-collapse">
              <tbody>
                {recentIncome.map(r => (
                  <tr key={r.id} className="border-b border-[#1e2535]/50">
                    <td className="p-3 font-mono text-xs text-[#4a566e]">{formatDate(r.date, dateFormat)}</td>
                    <td className="p-3 text-sm text-[#e8edf5]">{r.merchant_name || r.description}</td>
                    <td className="p-3 font-mono text-sm text-[#34d399] text-right">${r.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}