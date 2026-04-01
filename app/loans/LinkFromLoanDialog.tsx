"use client";

import { useState, useEffect } from "react";
import type { WaterfallResult } from "@/lib/loanTypes";
import { linkTransactionToLoan } from "@/app/loans/linkActions";

type LoanOption = {
  id: number;
  lenderDisplayName: string;
  borrowerDisplayName: string;
  outstandingBalance: number;
  interest_rate: number;
  term_months: number | null;
};

type UnlinkedTx = {
  id: number;
  date: string;
  description: string;
  merchant_name: string | null;
  amount: number;
  table: "expenses" | "income";
};

type Props = {
  loans: LoanOption[];
  onClose: () => void;
  onSuccess: () => void;
};

type Step = "loan" | "transaction" | "preview" | "confirming";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function LinkFromLoanDialog({ loans, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("loan");
  const [selectedLoan, setSelectedLoan] = useState<LoanOption | null>(null);
  const [unlinkedTxs, setUnlinkedTxs] = useState<UnlinkedTx[]>([]);
  const [selectedTx, setSelectedTx] = useState<UnlinkedTx | null>(null);
  const [preview, setPreview] = useState<WaterfallResult | null>(null);
  const [useSpecific, setUseSpecific] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/loans/unlinked-transactions")
      .then(r => r.json())
      .then(setUnlinkedTxs)
      .catch(() => setError("Failed to load unlinked transactions"));
  }, []);

  async function handleLoanSelect(loan: LoanOption) {
    setSelectedLoan(loan);
    setStep("transaction");
  }

  async function handleTxSelect(tx: UnlinkedTx) {
    setSelectedTx(tx);
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        loanId: selectedLoan!.id,
        paymentAmount: tx.amount,
        paymentDate: tx.date,
        targetLoanId: selectedLoan!.id,
      };
      const res = await fetch("/api/loans/preview-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to calculate preview");
      const result: WaterfallResult = await res.json();
      setPreview(result);
      setStep("preview");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview || !selectedTx || !selectedLoan) return;
    setStep("confirming");
    setError(null);
    try {
      const result = await linkTransactionToLoan({
        txId: selectedTx.id,
        table: selectedTx.table,
        transactionType: selectedTx.table === 'expenses' ? 'expense' : 'income',
        txDate: selectedTx.date,
        allocations: preview.allocations,
      });
      if (result.error) {
        setError(result.error);
        setStep("preview");
      } else {
        onSuccess();
      }
    } catch {
      setError("Failed to link transaction");
      setStep("preview");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <p className="font-mono text-xs text-gray-500 uppercase tracking-widest mb-0.5">
              Link Plaid Transaction
            </p>
            <p className="text-sm text-gray-400">
              {step === "loan" && "Step 1 — Select a loan"}
              {step === "transaction" && `Step 2 — Select a transaction for ${selectedLoan?.lenderDisplayName} → ${selectedLoan?.borrowerDisplayName}`}
              {(step === "preview" || step === "confirming") && selectedTx && (
                <>
                  {selectedTx.merchant_name || selectedTx.description} —{" "}
                  <span className="text-blue-400 font-mono">{fmt(selectedTx.amount)}</span>
                </>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition-colors text-lg font-mono">
            ✕
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-950 border border-red-700/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Step 1 — Pick loan */}
          {step === "loan" && (
            <div className="flex flex-col gap-2">
              {loans.map(loan => (
                <button
                  key={loan.id}
                  onClick={() => handleLoanSelect(loan)}
                  className="flex items-center justify-between px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl hover:border-blue-600/50 hover:bg-gray-750 transition-all text-left w-full"
                >
                  <div>
                    <div className="text-sm text-gray-200">
                      {loan.lenderDisplayName} → {loan.borrowerDisplayName}
                    </div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">
                      {(loan.interest_rate * 100).toFixed(2)}% · {loan.term_months ? `${loan.term_months} mo` : "Open-ended"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-white">{fmt(loan.outstandingBalance)}</div>
                    <div className="text-xs text-gray-500">outstanding</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2 — Pick transaction */}
          {step === "transaction" && (
            <div>
              {loading && (
                <p className="text-xs text-gray-500 font-mono animate-pulse">Loading…</p>
              )}
              {unlinkedTxs.length === 0 && !loading && (
                <p className="text-sm text-gray-500 text-center py-4">No unlinked Loan Transactions found.</p>
              )}
              <div className="flex flex-col gap-2">
                {unlinkedTxs.map(tx => (
                  <button
                    key={`${tx.table}-${tx.id}`}
                    onClick={() => handleTxSelect(tx)}
                    disabled={loading}
                    className="flex items-center justify-between px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl hover:border-blue-600/50 transition-all text-left w-full"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-200">
                          {tx.merchant_name || tx.description}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-mono border ${
                          tx.table === "expenses"
                            ? "bg-blue-950 border-blue-700/40 text-blue-400"
                            : "bg-green-950 border-green-700/40 text-green-400"
                        }`}>
                          {tx.table === "expenses" ? "Expense" : "Income"}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">{tx.date}</div>
                    </div>
                    <div className="text-sm font-mono text-white">{fmt(tx.amount)}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep("loan")}
                className="mt-4 w-full px-4 py-2.5 rounded-lg border border-gray-700 text-sm text-gray-400 hover:border-blue-600/30 hover:text-gray-200 transition-colors"
              >
                ← Back
              </button>
            </div>
          )}

          {/* Step 3 — Waterfall preview */}
          {(step === "preview" || step === "confirming") && preview && selectedTx && (
            <div>
              <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-4">
                Waterfall Preview
              </p>

              {loading ? (
                <p className="text-xs text-gray-500 font-mono animate-pulse">Recalculating…</p>
              ) : (
                <>
                  <div className="flex flex-col gap-2 mb-4">
                    {preview.allocations.map((a, i) => (
                      <div key={i} className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">
                            Loan #{a.loanId}
                          </span>
                          <span className="text-xs font-mono text-amber-400">
                            {a.paymentType === "capitalized_interest" ? "Capitalizing" : "Payment"}
                          </span>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <span className="text-gray-400">
                            Principal: <span className="text-gray-200 font-mono">{fmt(a.principalAmount)}</span>
                          </span>
                          <span className="text-gray-400">
                            Interest: <span className="text-green-400 font-mono">{fmt(a.interestAmount)}</span>
                          </span>
                        </div>
                        {a.notes && <p className="text-xs text-gray-500 mt-1">{a.notes}</p>}
                      </div>
                    ))}
                  </div>

                  {preview.allocations.length === 0 ? (
                    <p className="text-xs text-red-400 mb-3">
                      ⚠ This loan has no outstanding balance — nothing to apply this transaction to.
                    </p>
                  ) : preview.overpayment > 0 && (
                    <p className="text-xs text-amber-400 mb-3">
                      ⚠ Overpayment of {fmt(preview.overpayment)} — exceeds all outstanding balances.
                    </p>
                  )}
                  {preview.capitalizedAmount > 0 && (
                    <p className="text-xs text-amber-400 mb-3">
                      ⚠ {fmt(preview.capitalizedAmount)} in interest will be capitalized.
                    </p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => { setStep("transaction"); setPreview(null); }}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-gray-700 text-sm text-gray-400 hover:border-blue-600/30 hover:text-gray-200 transition-colors"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleConfirm}
                      disabled={step === "confirming" || preview.allocations.length === 0}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      {step === "confirming" ? "Saving…" : "Confirm Link"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}