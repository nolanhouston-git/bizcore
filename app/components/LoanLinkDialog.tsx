"use client";

import { useState, useEffect } from "react";
import type { WaterfallAllocation, WaterfallResult } from "@/lib/loanTypes";
import { linkTransactionToLoan } from "@/app/loans/linkActions";

type Member = { id: number; name: string };

type PendingTx = {
  id: number;
  date: string;
  description: string;
  amount: number;
};

type LoanOption = {
  id: number;
  lenderDisplayName: string;
  borrowerDisplayName: string;
  lender_type: string;
  borrower_type: string;
  outstandingBalance: number;
  interest_rate: number;
};

type Props = {
  pendingTx: PendingTx;
  members: Member[];
  transactionType: 'expense' | 'income';
  onClose: () => void;
  onSuccess: () => void;
};

type Step = "member" | "preview" | "confirming";

export default function LoanLinkDialog({ pendingTx, members, transactionType, onClose, onSuccess }: Props) {
  const [step, setStep]                         = useState<Step>("member");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [loans, setLoans]                       = useState<LoanOption[]>([]);
  const [targetLoanId, setTargetLoanId]         = useState<number | null>(null);
  const [useSpecific, setUseSpecific]           = useState(false);
  const [preview, setPreview]                   = useState<WaterfallResult | null>(null);
  const [loading, setLoading]                   = useState(false);
  const [error, setError]                       = useState<string | null>(null);
  const [filterDirection, setFilterDirection]   = useState(false);

  useEffect(() => {
    fetch("/api/settings/loan-filter")
      .then(r => r.json())
      .then(d => setFilterDirection(d.value === "on"))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedMemberId) return;
    fetchPreview(selectedMemberId, useSpecific ? targetLoanId : null);
  }, [selectedMemberId, targetLoanId, useSpecific]);

  async function fetchPreview(memberId: number, overrideLoanId: number | null) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        memberId: String(memberId),
        transactionType,
        filterDirection: String(filterDirection),
      });
      const loansRes = await fetch(`/api/loans/for-member?${params}`);
      if (!loansRes.ok) throw new Error("Failed to load loans");
      const memberLoans: LoanOption[] = await loansRes.json();
      setLoans(memberLoans);

      if (memberLoans.length === 0) {
        setError("This member has no active loans for this transaction type.");
        setLoading(false);
        return;
      }

      const seedLoanId = memberLoans[0].id;
      const body: Record<string, unknown> = {
        loanId: seedLoanId,
        paymentAmount: pendingTx.amount,
        paymentDate: pendingTx.date,
      };
      if (overrideLoanId) body.targetLoanId = overrideLoanId;

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
    if (!preview || !selectedMemberId) return;
    setStep("confirming");
    setError(null);
    try {
      const result = await linkTransactionToLoan({
        txId: pendingTx.id,
        table: transactionType === 'expense' ? 'expenses' : 'income',
        txDate: pendingTx.date,
        transactionType,
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

  function directionBadge(loan: LoanOption) {
    const businessIsBorrower = loan.borrower_type === 'business';
    const isRepayment =
      (transactionType === 'expense' && businessIsBorrower) ||
      (transactionType === 'income' && !businessIsBorrower);
    return isRepayment
      ? <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-mono bg-[#052e1a] border border-[#34d399]/30 text-[#34d399]">Repayment</span>
      : <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-mono bg-[#3d2f0a] border border-[#e8b84b]/30 text-[#e8b84b]">Disbursement</span>;
  }

  const selectedMember = members.find(m => m.id === selectedMemberId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div
        className="bg-[#0f1420] border border-[#1e2535] rounded-2xl w-full max-w-lg mx-4 overflow-hidden"
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2535]">
          <div>
            <p className="font-mono text-xs text-[#4a566e] uppercase tracking-widest mb-0.5">
              Link Loan Transaction
            </p>
            <p className="text-sm text-[#8896b0]">
              {pendingTx.description} —{" "}
              <span className="text-[#4f8ef7] font-mono">${pendingTx.amount.toFixed(2)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#4a566e] hover:text-[#e8edf5] transition-colors text-lg font-mono"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 px-4 py-3 bg-[#3b0a0a] border border-[#f87171]/30 rounded-lg text-sm text-[#f87171]">
              {error}
            </div>
          )}

          {step === "member" && (
            <div>
              <p className="text-sm text-[#8896b0] mb-4">
                Who is the counterparty on this loan?
              </p>
              <div className="flex flex-col gap-2">
                {members.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMemberId(m.id)}
                    disabled={loading}
                    className={`flex items-center gap-3 px-4 py-3 bg-[#080b12] border rounded-xl transition-all text-left w-full ${
                      selectedMemberId === m.id && loading
                        ? "border-[#4f8ef7]/50 bg-[#141926]"
                        : "border-[#1e2535] hover:border-[#4f8ef7]/50 hover:bg-[#141926]"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-mono transition-colors ${
                      selectedMemberId === m.id && loading
                        ? "bg-[#1a2540] border-[#4f8ef7]/60 text-[#4f8ef7]"
                        : "bg-[#1a2540] border-[#4f8ef7]/30 text-[#4f8ef7]"
                    }`}>
                      {selectedMemberId === m.id && loading ? "…" : m.name.charAt(0)}
                    </div>
                    <span className="text-sm text-[#e8edf5]">{m.name}</span>
                    {selectedMemberId === m.id && loading && (
                      <span className="ml-auto text-xs font-mono text-[#4a566e] animate-pulse">Loading…</span>
                    )}
                  </button>
                ))}
              </div>
              {loading && (
                <p className="text-xs text-[#4a566e] font-mono mt-4 animate-pulse">
                  Loading loans…
                </p>
              )}
            </div>
          )}

          {(step === "preview" || step === "confirming") && preview && selectedMember && (
            <div>
              <p className="text-xs font-mono text-[#4a566e] uppercase tracking-widest mb-4">
                Waterfall Preview — {selectedMember.name}
              </p>

              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => {
                    const next = !useSpecific;
                    setUseSpecific(next);
                    if (!next) setTargetLoanId(null);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono uppercase tracking-widest transition-colors ${
                    useSpecific
                      ? "bg-[#1a2540] border-[#4f8ef7]/40 text-[#4f8ef7]"
                      : "bg-[#0f1420] border-[#1e2535] text-[#4a566e] hover:border-[#4f8ef7]/30 hover:text-[#8896b0]"
                  }`}
                >
                  <span>{useSpecific ? "●" : "○"}</span>
                  <span>Apply to specific loan</span>
                </button>
              </div>

              {useSpecific && (
                <div className="flex flex-col gap-1.5 mb-4">
                  {loans.map(loan => (
                    <button
                      key={loan.id}
                      onClick={() => setTargetLoanId(loan.id)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${
                        targetLoanId === loan.id
                          ? "bg-[#1a2540] border-[#4f8ef7]/50 text-[#e8edf5]"
                          : "bg-[#080b12] border-[#1e2535] text-[#8896b0] hover:border-[#4f8ef7]/30"
                      }`}
                    >
                      <span className="flex items-center">
                        {loan.lenderDisplayName} → {loan.borrowerDisplayName}
                        {directionBadge(loan)}
                      </span>
                      <span className="font-mono text-xs text-[#4a566e]">
                        ${loan.outstandingBalance.toFixed(2)} @ {(loan.interest_rate * 100).toFixed(2)}%
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {loading ? (
                <p className="text-xs text-[#4a566e] font-mono animate-pulse">Recalculating…</p>
              ) : (
                <>
                  <div className="flex flex-col gap-2 mb-4">
                    {preview.allocations.map((a, i) => (
                      <div
                        key={i}
                        className="bg-[#080b12] border border-[#1e2535] rounded-xl px-4 py-3"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-[#4a566e] uppercase tracking-widest">
                            Loan #{a.loanId}
                          </span>
                          <span className="text-xs font-mono text-[#e8b84b]">
                            {a.paymentType === "capitalized_interest" ? "Capitalizing" : "Payment"}
                          </span>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <span className="text-[#8896b0]">
                            Principal:{" "}
                            <span className="text-[#e8edf5] font-mono">${a.principalAmount.toFixed(2)}</span>
                          </span>
                          <span className="text-[#8896b0]">
                            Interest:{" "}
                            <span className="text-[#34d399] font-mono">${a.interestAmount.toFixed(2)}</span>
                          </span>
                        </div>
                        {a.notes && (
                          <p className="text-xs text-[#4a566e] mt-1">{a.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {preview.allocations.length === 0 ? (
                    <p className="text-xs text-[#f87171] mb-3">
                      ⚠ This loan has no outstanding balance — nothing to apply this transaction to.
                    </p>
                  ) : preview.overpayment > 0 && (
                    <p className="text-xs text-[#e8b84b] mb-3">
                      ⚠ Overpayment of ${preview.overpayment.toFixed(2)} — exceeds all outstanding balances.
                    </p>
                  )}
                  {preview.capitalizedAmount > 0 && (
                    <p className="text-xs text-[#e8b84b] mb-3">
                      ⚠ ${preview.capitalizedAmount.toFixed(2)} in interest will be capitalized.
                    </p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setStep("member");
                        setPreview(null);
                        setUseSpecific(false);
                        setTargetLoanId(null);
                      }}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-[#1e2535] text-sm text-[#8896b0] hover:border-[#4f8ef7]/30 hover:text-[#e8edf5] transition-colors"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleConfirm}
                      disabled={step === "confirming" || preview.allocations.length === 0}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#4f8ef7] to-[#6366f1] text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
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
