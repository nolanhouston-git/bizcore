"use client";
import { useRef, useState } from "react";

const CATEGORIES = [
  "Payroll", "Rent", "Utilities", "Supplies", "Marketing",
  "Software", "Travel", "Research", "Professional Services",
  "Banking", "Distributions", "Loan Transaction", "Other"
];

type PendingTx = {
  id: number;
  date: string;
  description: string;
  amount: number;
};

type Props = {
  addExpense: (formData: FormData) => Promise<{ id: number } | { error: string }>;
  onLoanTransaction?: (tx: PendingTx) => void;
};

export default function ExpenseForm({ addExpense, onLoanTransaction }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState("Payroll");

  async function handleSubmit(formData: FormData) {
    const selectedCategory = formData.get("category") as string;
    const date        = formData.get("date") as string;
    const description = formData.get("description") as string;
    const merchant    = formData.get("merchant_name") as string;
    const amount      = parseFloat(formData.get("amount") as string);

    const result = await addExpense(formData);
    if ("error" in result) return;

    if (selectedCategory === "Loan Transaction" && onLoanTransaction) {
      onLoanTransaction({ id: result.id, date, description: merchant || description, amount });
    }

    formRef.current?.reset();
    setCategory("Payroll");
  }

  return (
    <div className="bg-[#0f1420] border border-[#1e2535] rounded-2xl p-6 mb-8">
      <p className="font-mono text-xs text-[#4a566e] uppercase tracking-widest mb-4">
        Log Manual Expense
      </p>
      <form ref={formRef} action={handleSubmit}>
        <div className="flex gap-3 flex-wrap">
          <input
            name="date"
            type="date"
            required
            className="bg-[#080b12] border border-[#1e2535] rounded-lg px-3 py-2 text-sm text-[#e8edf5] outline-none focus:border-[#4f8ef7] transition-colors"
          />
          <input
            name="description"
            type="text"
            placeholder="Description"
            required
            className="bg-[#080b12] border border-[#1e2535] rounded-lg px-3 py-2 text-sm text-[#e8edf5] outline-none focus:border-[#4f8ef7] transition-colors flex-1 min-w-[180px]"
          />
          <input
            name="merchant_name"
            type="text"
            placeholder="Merchant (optional)"
            className="bg-[#080b12] border border-[#1e2535] rounded-lg px-3 py-2 text-sm text-[#e8edf5] outline-none focus:border-[#4f8ef7] transition-colors"
          />
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="Amount ($)"
            required
            className="bg-[#080b12] border border-[#1e2535] rounded-lg px-3 py-2 text-sm text-[#e8edf5] outline-none focus:border-[#4f8ef7] transition-colors w-[130px]"
          />
          <select
            name="category"
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="bg-[#080b12] border border-[#1e2535] rounded-lg px-3 py-2 text-sm text-[#e8edf5] outline-none focus:border-[#4f8ef7] transition-colors"
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-gradient-to-r from-[#4f8ef7] to-[#6366f1] text-white rounded-lg px-5 py-2 text-sm font-bold hover:opacity-90 transition-opacity"
          >
            + Add
          </button>
        </div>
      </form>
    </div>
  );
}