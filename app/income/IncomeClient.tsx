"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import IncomeForm from "./IncomeForm";
import DeleteIncomeButton from "./DeleteIncomeButton";
import LoanLinkDialog from "@/app/components/LoanLinkDialog";
import { formatDate, type DateFormatKey } from "@/lib/dateFormat";
import { addIncome, deleteIncome, toggleLoanVisibility } from "./actions";

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

type PendingTx = {
  id: number;
  date: string;
  description: string;
  amount: number;
};

type Props = {
  records: Income[];
  members: Member[];
  showLoanTx: boolean;
  dateFormat: DateFormatKey;
};

const statusColors: Record<string, string> = {
  approved: "bg-[#052e1a] text-[#34d399] border-[#34d399]/30",
  pending:  "bg-[#3d2f0a] text-[#e8b84b] border-[#e8b84b]/30",
  imported: "bg-[#1e3a6e] text-[#4f8ef7] border-[#4f8ef7]/30",
};

const sourceColors: Record<string, string> = {
  manual: "bg-[#1e2535] text-[#8896b0] border-[#2a3550]",
  bank:   "bg-[#042f2e] text-[#2dd4bf] border-[#2dd4bf]/30",
  gusto:  "bg-[#3b0a2a] text-[#f472b6] border-[#f472b6]/30",
};

export default function IncomeClient({ records, members, showLoanTx, dateFormat }: Props) {
  const [pendingTx, setPendingTx] = useState<PendingTx | null>(null);
  const router = useRouter();

  return (
    <>
      {pendingTx && (
        <LoanLinkDialog
          pendingTx={pendingTx}
          members={members}
          transactionType="income"
          onClose={() => setPendingTx(null)}
          onSuccess={() => { setPendingTx(null); router.refresh(); }}
        />
      )}

      <IncomeForm onLoanTransaction={tx => setPendingTx(tx)} />

      <div className="flex items-center justify-end mb-4">
        <form action={toggleLoanVisibility}>
          <button
            type="submit"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono uppercase tracking-widest transition-colors ${
              showLoanTx
                ? "bg-[#1a2540] border-[#4f8ef7]/40 text-[#4f8ef7]"
                : "bg-[#0f1420] border-[#1e2535] text-[#4a566e] hover:border-[#4f8ef7]/30 hover:text-[#8896b0]"
            }`}
          >
            <span>{showLoanTx ? "●" : "○"}</span>
            <span>Loan Transactions</span>
          </button>
        </form>
      </div>

      <div className="overflow-x-auto">
        <div className="bg-[#0f1420] border border-[#1e2535] rounded-2xl overflow-hidden">
        <table className="min-w-[700px] w-full border-collapse">
          <thead>
            <tr className="border-b border-[#1e2535]">
              {["Date", "Description", "Category", "Amount", "Source", "Status", ""].map(h => (
                <th key={h} className="text-left p-4 font-mono text-xs text-[#4a566e] uppercase tracking-widest">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id} className="border-b border-[#1e2535]/50 hover:bg-[#141926] transition-colors">
                <td className="p-4 font-mono text-xs text-[#4a566e]">{formatDate(r.date, dateFormat)}</td>
                <td className="p-4 w-[220px]">
                  <div title={r.merchant_name ? `${r.merchant_name} — ${r.description}` : r.description}>
                    <div className="text-sm text-[#e8edf5] truncate">
                      {r.merchant_name || r.description}
                    </div>
                    {r.merchant_name && (
                      <div className="text-xs text-[#4a566e] font-mono truncate mt-0.5">{r.description}</div>
                    )}
                    {!r.merchant_name && (
                      <div className="text-xs text-[#4a566e] font-mono mt-0.5">&nbsp;</div>
                    )}
                  </div>
                </td>
                <td className="p-4 text-sm text-[#8896b0]">
                  {r.category}
                  {r.linked_loan_id && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-[#1a2540] border border-[#4f8ef7]/30 text-[#4f8ef7]">
                      loan #{r.linked_loan_id}
                    </span>
                  )}
                  {!r.linked_loan_id && r.category === 'Loan Transaction' && (
                    <button
                      onClick={() => setPendingTx({ id: r.id, date: r.date, description: r.merchant_name || r.description, amount: r.amount })}
                      title="Click to link this transaction to a loan"
                      className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono bg-[#3d2f0a] border border-[#e8b84b]/30 text-[#e8b84b] hover:bg-[#4a3a10] hover:border-[#e8b84b]/70 hover:text-[#fbbf24] transition-all cursor-pointer"
                    >
                      ⚠ Link Now →
                    </button>
                  )}
                </td>
                <td className="p-4 font-mono text-sm text-[#34d399]">${r.amount.toFixed(2)}</td>
                <td className="p-4">
                  <span className={`border rounded px-2 py-0.5 text-xs font-mono uppercase tracking-wider ${sourceColors[r.source] || sourceColors.manual}`}>
                    {r.source}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`border rounded px-2 py-0.5 text-xs font-mono uppercase tracking-wider ${statusColors[r.status] || statusColors.pending}`}>
                    {r.status}
                  </span>
                </td>
                <td className="p-4">
                  <DeleteIncomeButton id={r.id} deleteIncome={async (id) => { await deleteIncome(id); }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
}