'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { addLoan, amendLoan, deleteLoan } from './actions'
import type { LoanWithHistory } from '@/lib/loanTypes'

type Member = {
  id: number
  name: string
  ownership_pct: number
  role: string
}

type Props = {
  members: Member[]
  businessId: number
  editLoan?: LoanWithHistory
  triggerButton?: React.ReactNode
}

const COMPOUNDING_OPTIONS = [
  { value: 'simple',     label: 'Simple (no compounding)' },
  { value: 'daily',      label: 'Daily' },
  { value: 'monthly',    label: 'Monthly' },
  { value: 'quarterly',  label: 'Quarterly' },
  { value: 'semiannual', label: 'Semiannual' },
  { value: 'annual',     label: 'Annual' },
  { value: 'continuous', label: 'Continuous' },
]

function pctToDisplay(rate: number): string {
  return (rate * 100).toFixed(2)
}

export default function AddLoanForm({ members, businessId, editLoan, triggerButton }: Props) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [direction, setDirection] = useState<'member_to_business' | 'business_to_member'>(
    editLoan
      ? (editLoan.lender_type === 'member' ? 'member_to_business' : 'business_to_member')
      : 'member_to_business'
  )
  const [interestRate, setInterestRate] = useState(
    editLoan ? pctToDisplay(editLoan.interest_rate) : ''
  )
  const [termMonths, setTermMonths] = useState(
    editLoan?.term_months ? String(editLoan.term_months) : ''
  )
  const [afrRates, setAfrRates] = useState<{ short: number; mid: number; long: number } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const isEdit = !!editLoan
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetch('/api/afr')
      .then(r => r.json())
      .then(data => setAfrRates(data))
      .catch(() => null)
  }, [])

  function getAfrForTerm(): number {
    if (!afrRates) return 0
    const months = parseInt(termMonths)
    if (!months || months <= 36) return afrRates.short
    if (months <= 108) return afrRates.mid
    return afrRates.long
  }

  function fillAfr() {
    const rate = getAfrForTerm()
    if (rate > 0) setInterestRate(pctToDisplay(rate))
  }

  async function handleDelete() {
    const reasonField = document.querySelector('textarea[name="reason"]') as HTMLTextAreaElement
    const reason = reasonField?.value?.trim()
    if (!reason) {
      setError('Please enter a reason before deleting')
      reasonField?.focus()
      return
    }
    setShowDeleteConfirm(true)
  }

  async function handleConfirmDelete() {
    const reasonField = document.querySelector('textarea[name="reason"]') as HTMLTextAreaElement
    const reason = reasonField?.value?.trim() ?? ''
    setLoading(true)
    setDeleteError(null)
    const result = await deleteLoan(editLoan!.id, reason)
    setLoading(false)
    if (result.error) {
      setDeleteError(result.error)
      return
    }
    closeDialog()
    router.refresh()
  }

  function openDialog() {
    setError(null)
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    dialogRef.current?.close()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = e.currentTarget
    const data = new FormData(form)

    if (isEdit) {
      const result = await amendLoan(data, editLoan)
      setLoading(false)
      if (result.error) { setError(result.error); return }
    } else {
      data.set('direction', direction)
      data.set('businessId', String(businessId))
      const result = await addLoan(data)
      setLoading(false)
      if (result.error) { setError(result.error); return }
    }

    form.reset()
    closeDialog()
    router.refresh()
  }

  const currentMemberId = isEdit
    ? (editLoan.lender_type === 'member' ? editLoan.lender_id : editLoan.borrower_id)
    : undefined

  return (
    <>
      {triggerButton ? (
        <span onClick={openDialog} className="cursor-pointer">{triggerButton}</span>
      ) : (
        <button
          onClick={openDialog}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          + Add Loan
        </button>
      )}

      <dialog
        ref={dialogRef}
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-0 w-full max-w-lg backdrop:bg-black/60"
      >
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? 'Edit Loan' : 'Add Member Loan'}
          </h2>
          <button type="button" onClick={closeDialog} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Loan direction — locked in edit mode */}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wide mb-2">Loan Direction</label>
            {isEdit ? (
              <div className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300">
                {direction === 'member_to_business' ? 'Member → Business' : 'Business → Member'}
                <span className="text-gray-500 ml-2 text-xs">(cannot change after creation)</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setDirection('member_to_business')}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors text-left ${direction === 'member_to_business' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                  <div className="font-medium">Member → Business</div>
                  <div className="text-xs opacity-70 mt-0.5">Member loans money to the business</div>
                </button>
                <button type="button" onClick={() => setDirection('business_to_member')}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors text-left ${direction === 'business_to_member' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                  <div className="font-medium">Business → Member</div>
                  <div className="text-xs opacity-70 mt-0.5">Business advances money to a member</div>
                </button>
              </div>
            )}
          </div>

          {/* Member */}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Member</label>
            <select name="memberId" required defaultValue={currentMemberId}
              disabled={isEdit}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-60">
              <option value="">Select member…</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.ownership_pct}%)</option>
              ))}
            </select>
            {isEdit && <p className="text-xs text-gray-500 mt-1">Member cannot be changed after creation</p>}
          </div>

          {/* Amount + Rate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Original Amount</label>
              <input type="number" name="originalAmount" required min="0.01" step="0.01"
                defaultValue={editLoan?.original_amount}
                disabled={isEdit}
                placeholder="0.00"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-60" />
              {isEdit && <p className="text-xs text-gray-500 mt-1">Original amount is immutable</p>}
            </div>
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Interest Rate (%)</label>
              <div className="flex gap-1.5">
                <input type="number" name="interestRate" required min="0" step="0.01"
                  value={interestRate}
                  onChange={e => setInterestRate(e.target.value)}
                  placeholder="0.00"
                  className="w-full min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                <button type="button" onClick={fillAfr}
                  disabled={!afrRates}
                  title={afrRates ? `Fill with applicable AFR (${pctToDisplay(getAfrForTerm())}%)` : 'Loading AFR...'}
                  className="flex-shrink-0 px-2 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-xs text-gray-300 border border-gray-600 whitespace-nowrap transition-colors">
                  AFR
                </button>
              </div>
            </div>
          </div>
          {afrRates && (
            <p className="text-xs text-gray-500 -mt-2">
              Applicable AFR: {pctToDisplay(getAfrForTerm())}%{!termMonths && ' (short-term, open-ended)'}
            </p>
          )}

          {/* Compounding */}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Compounding Frequency</label>
            <select name="compoundingFrequency" defaultValue={editLoan?.compounding_frequency ?? 'simple'}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
              {COMPOUNDING_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Term + Start date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Term (months, optional)</label>
              <input type="number" name="termMonths" min="1" step="1"
                value={termMonths}
                onChange={e => setTermMonths(e.target.value)}
                placeholder="Leave blank = open-ended"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Start Date</label>
              <input type="date" name="startDate" required
                defaultValue={editLoan?.start_date ?? today}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Notes (optional)</label>
            <textarea name="notes" rows={2}
              defaultValue={editLoan?.notes ?? ''}
              placeholder="Purpose of loan, repayment expectations…"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none" />
          </div>

          {/* Reason — required for edits only */}
          {isEdit && (
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
                Reason for Change <span className="text-red-400">*</span>
              </label>
              <textarea name="reason" rows={2} required
                placeholder="e.g. Incorrectly entered interest rate, correcting to 4.5%…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none border-amber-700/50" />
              <p className="text-xs text-amber-500/70 mt-1">Required — logged to amendment history for audit purposes</p>
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeDialog}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Loan'}
            </button>
          </div>

          {isEdit && !showDeleteConfirm && (
            <div className="pt-2 border-t border-gray-800">
              <button
                type="button"
                onClick={handleDelete}
                className="w-full py-2 rounded-lg border border-red-800/50 text-sm text-red-400 hover:bg-red-900/20 hover:border-red-700 transition-colors"
              >
                Delete this loan
              </button>
            </div>
          )}

        </form>

        {showDeleteConfirm && (
          <div className="px-6 pb-6 space-y-4">
            <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
              <p className="text-red-300 text-sm font-medium mb-1">Confirm Deletion</p>
              <p className="text-red-400/70 text-xs">
                This will permanently remove the loan from the register.
                The record will be retained in the audit history.
              </p>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Loan being deleted</p>
              <p className="text-white">{editLoan?.lenderDisplayName} → {editLoan?.borrowerDisplayName}</p>
              <p className="font-mono text-gray-300 text-xs mt-1">
                Original: ${editLoan?.original_amount.toLocaleString()} · Outstanding: ${editLoan?.outstandingBalance.toLocaleString()}
              </p>
              {editLoan && editLoan.outstandingBalance > 0 && (
                <p className="text-amber-400 text-xs mt-2">
                  ⚠ This loan has an outstanding balance of ${editLoan.outstandingBalance.toLocaleString()}
                </p>
              )}
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Reason being logged</p>
              <p className="text-gray-300 text-xs italic">
                {(typeof document !== 'undefined'
                  ? (document.querySelector('textarea[name="reason"]') as HTMLTextAreaElement)?.value
                  : '') || '—'}
              </p>
            </div>

            {deleteError && (
              <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{deleteError}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {loading ? 'Deleting…' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  )
}
