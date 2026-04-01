"use client";

import { useEffect, useState } from "react";

type Account = {
  account_id:    string;
  name:          string;
  official_name: string | null;
  type:          string;
  subtype:       string | null;
  balance:       number | null;
  currency:      string | null;
};

export default function AccountsList() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch("/api/plaid/accounts")
      .then(res => res.json())
      .then(data => {
        if (data.accounts) setAccounts(data.accounts);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-[#4a566e] font-mono text-sm">Loading accounts…</div>
    );
  }

  if (accounts.length === 0) return null;

  return (
    <div className="bg-[#0f1420] border border-[#1e2535] rounded-2xl overflow-hidden mb-8">
      <div className="p-4 border-b border-[#1e2535]">
        <p className="font-mono text-xs text-[#4a566e] uppercase tracking-widest">
          Linked Accounts — {accounts.length} total
        </p>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[#1e2535]">
            {["Account", "Type", "Balance"].map(h => (
              <th key={h} className="text-left p-4 font-mono text-xs text-[#4a566e] uppercase tracking-widest">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {accounts.map(a => (
            <tr key={a.account_id} className="border-b border-[#1e2535]/50">
              <td className="p-4">
                <p className="text-sm text-[#e8edf5]">{a.name}</p>
                {a.official_name && a.official_name !== a.name && (
                  <p className="text-xs text-[#4a566e] font-mono mt-0.5">{a.official_name}</p>
                )}
              </td>
              <td className="p-4">
                <span className="bg-[#1e2535] text-[#8896b0] border border-[#2a3550] rounded px-2 py-0.5 text-xs font-mono uppercase tracking-wider">
                  {a.subtype || a.type}
                </span>
              </td>
              <td className="p-4 font-mono text-sm text-[#4f8ef7]">
                {a.balance !== null
                  ? `$${a.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}