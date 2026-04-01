"use client";

import { useRef } from "react";
import { addIncome } from "./actions";

const CATEGORIES = [
  "Consulting", "Research Project", "Retainer", "Product", "Reimbursement",
  "Loan Transaction", "Other Income",
];

type PendingTx = {
  id: number;
  date: string;
  description: string;
  amount: number;
};

type Props = {
  onLoanTransaction: (tx: PendingTx) => void;
};

export default function IncomeForm({ onLoanTransaction }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    const category    = formData.get("category") as string;
    const date        = formData.get("date") as string;
    const description = formData.get("description") as string;
    const client      = formData.get("client_name") as string;
    const amount      = parseFloat(formData.get("amount") as string);

    const result = await addIncome(formData);
    if ("error" in result) return;

    if (category === "Loan Transaction") {
      onLoanTransaction({ id: result.id, date, description: client || description, amount });
    }

    formRef.current?.reset();
  }

  return (
    <div className="bg-[#0f1420] border border-[#1e2535] rounded-2xl p-6 mb-8">
      <p className="font-mono text-xs text-[#4a566e] uppercase tracking-widest mb-4">
        Log Manual Income
      </p>
      <form ref={formRef} action={handleSubmit}>
        <div className="flex gap-3 flex-wrap">
          <input
            name="date"
            type="date"
            required
            className="bg-[#080b12] border border-[#1e2535] rounded-lg px-3 py-2 text-sm text-[#e8edf5] outline-none focus:border-[#34d399] transition-colors"
          />
          <input
            name="description"
            type="text"
            placeholder="Description"
            required
            className="bg-[#080b12] border border-[#1e2535] rounded-lg px-3 py-2 text-sm text-[#e8edf5] outline-none focus:border-[#34d399] transition-colors flex-1 min-w-[180px]"
          />
          <input
            name="client_name"
            type="text"
            placeholder="Client (optional)"
            className="bg-[#080b12] border border-[#1e2535] rounded-lg px-3 py-2 text-sm text-[#e8edf5] outline-none focus:border-[#34d399] transition-colors"
          />
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="Amount ($)"
            required
            className="bg-[#080b12] border border-[#1e2535] rounded-lg px-3 py-2 text-sm text-[#e8edf5] outline-none focus:border-[#34d399] transition-colors w-[130px]"
          />
          <select
            name="category"
            className="bg-[#080b12] border border-[#1e2535] rounded-lg px-3 py-2 text-sm text-[#e8edf5] outline-none focus:border-[#34d399] transition-colors"
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-gradient-to-r from-[#34d399] to-[#059669] text-white rounded-lg px-5 py-2 text-sm font-bold hover:opacity-90 transition-opacity"
          >
            + Add
          </button>
        </div>
      </form>
    </div>
  );
}