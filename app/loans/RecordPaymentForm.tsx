'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LoanWithHistory, WaterfallResult } from '@/lib/loanTypes'
import { recordPayment } from './actions'

type Member = {
  id: number
  name: string
  ownership_pct: number
  role: string
}

type Props = {
  loan: LoanWithHistory
  members: Member[]
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export default function RecordPaymentForm({ loan, members: _members }: Props) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<WaterfallResult | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [targetLoan, setTargetLoan] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(today)
  const [notes, setNotes] = useState('')

  function openDialog() {
    setError(null)
    setPreview(null)
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    dialogRef.current?.close()
    setPaymentAmount('')
    setPaymentDate(today)
    setNotes('')
    setPreview(null)
    setError(null)
  }

  async function handlePreview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPreviewing(true)

    const body = {
      loanId: loan.id,
      paymentAmount: parseFloat(paymentAmount),
      paymentDate: paymentDate,
      targetLoanId: targetLoan ? loan.id : undefined,
    }

    try {
      const res = await fetch('/api/loans/preview-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setPreview(data)
      }
    } catch {
      setError('Failed to calculate payment preview')
    } finally {
      setPreviewing(false)
    }
  }

  async function handleConfirm() {
    if (!preview) return
    setLoading(true)
    setError(null)

    const result = await recordPayment({
      loanId: loan.id,
      allocations: preview.allocations,
      paymentDate: paymentDate,
      notes: notes,
    })

    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    closeDialog()
    router.refresh()
  }

  return (
    <>
      <button
        onClick={openDialog}
        disabled={loan.outstandingBalance <= 0}
        className="px-3 py-1.5 rounded text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
      >
        Payment
      </button>

      <dialog
        ref={dialogRef}
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-0 w-full max-w-lg backdrop:bg-black/60"
      >
        <div className="px-6 py-4 border-b border-gray-800 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-white">Record Payment</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {loan.lenderDisplayName} → {loan.borrowerDisplayName}
              <span className="ml-2 font-mono text-gray-300">{fmt(loan.outstandingBalance)} outstanding</span>
            </p>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5">
          {!preview ? (
            <form onSubmit={handlePreview} className="space-y-4">

              {/* Amount + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
                    Payment Amount
                  </label>
                  <input
                    type="number"
                    name="paymentAmount"
                    required
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    name="paymentDate"
                    required
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Target loan override */}
              <div className="flex items-start gap-3 bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3">
                <input
                  type="checkbox"
                  id="targetLoan"
                  checked={targetLoan}
                  onChange={e => setTargetLoan(e.target.checked)}
                  className="mt-0.5"
                />
                <div>
                  <label htmlFor="targetLoan" className="text-sm text-gray-300 cursor-pointer">
                    Apply to this loan only
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    By default payments are applied across all loans for this member using the waterfall (highest rate first)
                  </p>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
                  Notes (optional)
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Reference, check number, transfer details…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={previewing}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {previewing ? 'Calculating…' : 'Preview Payment →'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Review how this payment will be applied before confirming:
              </p>

              {/* Allocation breakdown */}
              <div className="space-y-2">
                {preview.allocations.map((a, i) => (
                  <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400 uppercase tracking-wide">
                        {a.paymentType === 'capitalized_interest' ? 'Capitalize Interest' : 'Payment'}
                      </span>
                      <span className="text-xs text-gray-500">{a.daysCovered} days covered</span>
                    </div>
                    <div className="text-sm">
                      {a.principalAmount !== 0 && a.interestAmount === 0 && (
                        <div>
                          <span className="text-gray-400">Principal: </span>
                          <span className="font-mono text-white">{fmt(Math.abs(a.principalAmount))}</span>
                          {a.principalAmount < 0 && (
                            <span className="text-amber-400 text-xs ml-1">(added to balance)</span>
                          )}
                        </div>
                      )}
                      {a.interestAmount > 0 && a.principalAmount === 0 && (
                        <div>
                          <span className="text-gray-400">Interest: </span>
                          <span className="font-mono text-white">{fmt(a.interestAmount)}</span>
                          <span className="text-green-400 text-xs ml-1">(deductible)</span>
                        </div>
                      )}
                      {a.principalAmount !== 0 && a.interestAmount > 0 && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-gray-400">Principal: </span>
                            <span className="font-mono text-white">{fmt(Math.abs(a.principalAmount))}</span>
                            {a.principalAmount < 0 && (
                              <span className="text-amber-400 text-xs ml-1">(added to balance)</span>
                            )}
                          </div>
                          <div>
                            <span className="text-gray-400">Interest: </span>
                            <span className="font-mono text-white">{fmt(a.interestAmount)}</span>
                            <span className="text-green-400 text-xs ml-1">(deductible)</span>
                          </div>
                        </div>
                      )}
                    </div>
                    {notes && (
                      <p className="text-xs text-gray-500 mt-1">{notes}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Warnings */}
              {preview.overpayment > 0 && (
                <div className="bg-amber-900/20 border border-amber-700 rounded-lg px-4 py-3">
                  <p className="text-amber-300 text-sm font-medium">Overpayment: {fmt(preview.overpayment)}</p>
                  <p className="text-amber-400/70 text-xs mt-0.5">
                    Payment exceeds total outstanding balance. The excess will not be applied.
                  </p>
                </div>
              )}
              {preview.capitalizedAmount > 0 && (
                <div className="bg-amber-900/20 border border-amber-700 rounded-lg px-4 py-3">
                  <p className="text-amber-300 text-sm font-medium">
                    Capitalizing {fmt(preview.capitalizedAmount)} in unpaid interest
                  </p>
                  <p className="text-amber-400/70 text-xs mt-0.5">
                    This interest will be added to the principal balance and is deductible when paid in cash.
                  </p>
                </div>
              )}

              {error && (
                <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {loading ? 'Saving…' : 'Confirm Payment'}
                </button>
              </div>
            </div>
          )}
        </div>
      </dialog>
    </>
  )
}