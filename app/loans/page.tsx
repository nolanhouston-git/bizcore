import { formatDate, type DateFormatKey } from '@/lib/dateFormat'
import Link from 'next/link'
import db from '@/lib/db'
import type { LoanRow, LoanPaymentRow, LoanWithHistory } from '@/lib/loanTypes'
import AddLoanForm from './AddLoanForm'
import RecordPaymentForm from './RecordPaymentForm'
import LoansClient from './LoansClient'

const BUSINESS_ID = 1

// ── Types ─────────────────────────────────────────────────────────────────────

type MemberRow = {
  id: number
  name: string
  ownership_pct: number
  role: string
}

type AfrRates = {
  short: number
  mid: number
  long: number
  month: string
  fallback?: boolean
}

// ── Database helpers ──────────────────────────────────────────────────────────

function getLoansWithHistory(): LoanWithHistory[] {
  const loans = db.prepare(`
    SELECT l.*,
      CASE l.lender_type
        WHEN 'member'   THEN bm_lender.name
        WHEN 'business' THEN b_lender.name
        ELSE 'External'
      END as lenderDisplayName,
      CASE l.borrower_type
        WHEN 'member'   THEN bm_borrower.name
        WHEN 'business' THEN b_borrower.name
        ELSE 'External'
      END as borrowerDisplayName
    FROM loans l
    LEFT JOIN business_members bm_lender
      ON l.lender_type = 'member' AND l.lender_id = bm_lender.id
    LEFT JOIN businesses b_lender
      ON l.lender_type = 'business' AND l.lender_id = b_lender.id
    LEFT JOIN business_members bm_borrower
      ON l.borrower_type = 'member' AND l.borrower_id = bm_borrower.id
    LEFT JOIN businesses b_borrower
      ON l.borrower_type = 'business' AND l.borrower_id = b_borrower.id
    WHERE l.business_id = ? AND l.deleted_at IS NULL
    ORDER BY l.created_at DESC
  `).all(BUSINESS_ID) as (LoanRow & { lenderDisplayName: string; borrowerDisplayName: string })[]

  return loans.map(loan => {
    const payments = db.prepare(`
      SELECT * FROM loan_payments
      WHERE loan_id = ? AND deleted_at IS NULL
      ORDER BY payment_date ASC
    `).all(loan.id) as LoanPaymentRow[]

    // Outstanding balance = original_amount - SUM(principal_amount)
    // principal_amount is positive for payments (reduces balance)
    // and negative for advances and capitalized_interest (increases balance)
    const outstandingBalance = Math.round(
      (payments.reduce(
        (bal, p) => bal - p.principal_amount,
        loan.original_amount
      )) * 100
    ) / 100

    // Outstanding original principal only — excludes capitalized interest balance
    const capitalizedBalance = payments
      .filter(p => p.payment_type === 'capitalized_interest')
      .reduce((sum, p) => sum + Math.abs(p.principal_amount), 0)

    const outstandingPrincipal = Math.max(0, outstandingBalance - capitalizedBalance)

    return {
      ...loan,
      payments,
      outstandingBalance,
      outstandingPrincipal,
    }
  })
}

function getMembers(): MemberRow[] {
  return db.prepare(`
    SELECT id, name, ownership_pct, role
    FROM business_members
    WHERE business_id = ? AND active = 1
    ORDER BY ownership_pct DESC
  `).all(BUSINESS_ID) as MemberRow[]
}

function getBusinessId(): number {
  const biz = db.prepare('SELECT id FROM businesses WHERE id = ?').get(BUSINESS_ID) as { id: number } | undefined
  return biz?.id ?? BUSINESS_ID
}

function getSetting(key: string): string | null {
  const row = db.prepare(`
    SELECT value FROM settings WHERE business_id = ? AND key = ?
  `).get(BUSINESS_ID, key) as { value: string } | undefined
  return row?.value ?? null
}

async function getAfrRates(): Promise<AfrRates> {
  try {
    const res = await fetch('http://localhost:3000/api/afr', { cache: 'no-store' })
    if (!res.ok) throw new Error('AFR fetch failed')
    return await res.json()
  } catch {
    // Hardcoded fallback — January 2026 IRS Revenue Ruling 2026-2
    return { short: 0.0363, mid: 0.0381, long: 0.0463, month: 'fallback', fallback: true }
  }
}

// ── AFR helpers ───────────────────────────────────────────────────────────────

function getApplicableAfr(afr: AfrRates, termMonths: number | null): number {
  if (!termMonths) return afr.short  // open-ended = short-term
  if (termMonths <= 36) return afr.short
  if (termMonths <= 108) return afr.mid
  return afr.long
}

function isBelowAfr(rate: number, afr: AfrRates, termMonths: number | null): boolean {
  return rate < getApplicableAfr(afr, termMonths)
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(2) + '%'
}

function fmtFrequency(f: string): string {
  const map: Record<string, string> = {
    simple: 'Simple', daily: 'Daily', monthly: 'Monthly',
    quarterly: 'Quarterly', semiannual: 'Semiannual',
    annual: 'Annual', continuous: 'Continuous'
  }
  return map[f] ?? f
}

// ── Recent payments query ─────────────────────────────────────────────────────

type RecentPayment = LoanPaymentRow & {
  lenderDisplayName: string
  borrowerDisplayName: string
}

function getRecentPayments(): RecentPayment[] {
  const rows = db.prepare(`
    SELECT lp.*,
      CASE l.lender_type
        WHEN 'member'   THEN bm_lender.name
        WHEN 'business' THEN b_lender.name
        ELSE 'External'
      END as lenderDisplayName,
      CASE l.borrower_type
        WHEN 'member'   THEN bm_borrower.name
        WHEN 'business' THEN b_borrower.name
        ELSE 'External'
      END as borrowerDisplayName
    FROM loan_payments lp
    JOIN loans l ON lp.loan_id = l.id
    LEFT JOIN business_members bm_lender
      ON l.lender_type = 'member' AND l.lender_id = bm_lender.id
    LEFT JOIN businesses b_lender
      ON l.lender_type = 'business' AND l.lender_id = b_lender.id
    LEFT JOIN business_members bm_borrower
      ON l.borrower_type = 'member' AND l.borrower_id = bm_borrower.id
    LEFT JOIN businesses b_borrower
      ON l.borrower_type = 'business' AND l.borrower_id = b_borrower.id
    WHERE lp.business_id = ? AND lp.deleted_at IS NULL
    ORDER BY lp.payment_date DESC, lp.created_at DESC
    LIMIT 20
  `).all(BUSINESS_ID) as RecentPayment[]

  // Group rows by loan_id + payment_date into single display rows
  const grouped = new Map<string, RecentPayment>()
  for (const row of rows) {
    const key = `${row.loan_id}-${row.payment_date}-${row.created_at}`
    if (grouped.has(key)) {
      const existing = grouped.get(key)!
      existing.principal_amount += row.principal_amount
      existing.interest_amount += row.interest_amount
    } else {
      grouped.set(key, { ...row })
    }
  }

  return Array.from(grouped.values()).slice(0, 10)
}

function getUnlinkedCount(): number {
  const expCount = (db.prepare(`
    SELECT COUNT(*) as cnt FROM expenses
    WHERE business_id = ? AND deleted_at IS NULL
      AND category = 'Loan Transaction' AND linked_loan_id IS NULL
  `).get(BUSINESS_ID) as { cnt: number }).cnt

  const incCount = (db.prepare(`
    SELECT COUNT(*) as cnt FROM income
    WHERE business_id = ? AND deleted_at IS NULL
      AND category = 'Loan Transaction' AND linked_loan_id IS NULL
  `).get(BUSINESS_ID) as { cnt: number }).cnt

  return expCount + incCount
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function LoansPage() {
  const loans = getLoansWithHistory()
  const members = getMembers()
  const businessId = getBusinessId()
  const afr = await getAfrRates()
  const recentPayments = getRecentPayments()
  const showLoanTransactions = getSetting('show_loan_transactions') ?? 'off'
  const dateFormat = (getSetting('date_format') ?? 'Mon DD, YYYY') as DateFormatKey
  const unlinkedCount = getUnlinkedCount()
  const loansForDialog = loans.map(l => ({
    id: l.id,
    lenderDisplayName: l.lenderDisplayName,
    borrowerDisplayName: l.borrowerDisplayName,
    outstandingBalance: l.outstandingBalance,
    interest_rate: l.interest_rate,
    term_months: l.term_months,
  }))

  const totalOriginal = loans.reduce((sum, l) => sum + l.original_amount, 0)
  const totalOutstanding = loans.reduce((sum, l) => sum + l.outstandingBalance, 0)
  const totalCapitalized = loans.reduce((sum, l) => {
    return sum + l.payments
      .filter(p => p.payment_type === 'capitalized_interest')
      .reduce((s, p) => s + Math.abs(p.principal_amount), 0)
  }, 0)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Loans & Member Advances</h1>
            <p className="text-gray-400 text-sm mt-1">Track member loans and repayment history</p>
          </div>
          <div className="flex items-center gap-3">
              <LoansClient loans={loansForDialog} hasUnlinked={unlinkedCount > 0} />
              <AddLoanForm members={members} businessId={businessId} />
            </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
          <span className="px-4 py-2 rounded-md text-sm bg-gray-700 text-white font-medium">
            Register
          </span>
          <Link href="/loans/history" className="px-4 py-2 rounded-md text-sm text-gray-400 hover:text-gray-200 transition-colors">
            History
          </Link>
        </div>

        {/* AFR Reference Bar */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                IRS Applicable Federal Rates — {afr.month === 'fallback' ? 'Fallback (Jan 2026)' : afr.month}
                {afr.fallback && (
                  <span className="ml-2 text-amber-400">(live fetch unavailable)</span>
                )}
              </p>
              <div className="flex gap-6 text-sm">
                <span className="text-gray-300">
                  Short-term <span className="text-white font-mono font-medium">{fmtPct(afr.short)}</span>
                  <span className="text-gray-500 ml-1">(≤3 yr)</span>
                </span>
                <span className="text-gray-300">
                  Mid-term <span className="text-white font-mono font-medium">{fmtPct(afr.mid)}</span>
                  <span className="text-gray-500 ml-1">(3–9 yr)</span>
                </span>
                <span className="text-gray-300">
                  Long-term <span className="text-white font-mono font-medium">{fmtPct(afr.long)}</span>
                  <span className="text-gray-500 ml-1">(9+ yr)</span>
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              IRC §1274 — member loans must meet or exceed the applicable rate
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Loaned</p>
            <p className="text-2xl font-bold text-white font-mono">{fmt(totalOriginal)}</p>
            <p className="text-xs text-gray-500 mt-1">{loans.length} active loan{loans.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Outstanding Balance</p>
            <p className="text-2xl font-bold text-white font-mono">{fmt(totalOutstanding)}</p>
            <p className="text-xs text-gray-500 mt-1">Principal + capitalized interest</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Capitalized Interest</p>
            <p className="text-2xl font-bold font-mono {totalCapitalized > 0 ? 'text-amber-400' : 'text-white'}">{fmt(totalCapitalized)}</p>
            <p className="text-xs text-gray-500 mt-1">Deductible when paid in cash</p>
          </div>
        </div>

        {/* Loan Register */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">Loan Register</h2>
          </div>

          {loans.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No loans recorded yet. Use the Add Loan button to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Lender</th>
                    <th className="px-4 py-3 text-left">Borrower</th>
                    <th className="px-4 py-3 text-right">Original</th>
                    <th className="px-4 py-3 text-right">Outstanding</th>
                    <th className="px-4 py-3 text-center">Rate</th>
                    <th className="px-4 py-3 text-center">Compounding</th>
                    <th className="px-4 py-3 text-center">Term</th>
                    <th className="px-4 py-3 text-center">Start Date</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map(loan => {
                    const belowAfr = isBelowAfr(loan.interest_rate, afr, loan.term_months)
                    const applicableAfr = getApplicableAfr(afr, loan.term_months)
                    return (
                      <tr key={loan.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 text-gray-200">{loan.lenderDisplayName}</td>
                        <td className="px-4 py-3 text-gray-200">{loan.borrowerDisplayName}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">{fmt(loan.original_amount)}</td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-white">{fmt(loan.outstandingBalance)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-mono text-white">{fmtPct(loan.interest_rate)}</span>
                          {belowAfr && (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-900/50 text-amber-300 border border-amber-700">
                                ⚠ Below AFR ({fmtPct(applicableAfr)})
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-400">{fmtFrequency(loan.compounding_frequency)}</td>
                        <td className="px-4 py-3 text-center text-gray-400">
                          {loan.term_months ? `${loan.term_months} mo` : 'Open-ended'}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-400">{formatDate(loan.start_date, dateFormat)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <RecordPaymentForm loan={loan} members={members} />
                            <AddLoanForm
                              members={members}
                              businessId={businessId}
                              editLoan={loan}
                              triggerButton={
                                <span className="px-3 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600 cursor-pointer transition-colors">
                                  Edit
                                </span>
                              }
                            />
                            <button
                              disabled
                              className="px-3 py-1.5 rounded text-xs bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed"
                              title="Available in Session 14 — Document Generator"
                            >
                              Note
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Payments */}
        {recentPayments.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">Recent Payment Activity</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Lender → Borrower</th>
                    <th className="px-4 py-3 text-center">Type</th>
                    <th className="px-4 py-3 text-right">Principal</th>
                    <th className="px-4 py-3 text-right">Interest</th>
                    <th className="px-4 py-3 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map(p => (
                    <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3 text-gray-400">{formatDate(p.payment_date, dateFormat)}</td>
                      <td className="px-4 py-3 text-gray-300">
                        {p.lenderDisplayName} → {p.borrowerDisplayName}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={
                          p.payment_type === 'payment' ? 'px-2 py-0.5 rounded text-xs bg-green-900/50 text-green-300 border border-green-800' :
                          p.payment_type === 'advance' ? 'px-2 py-0.5 rounded text-xs bg-blue-900/50 text-blue-300 border border-blue-800' :
                          'px-2 py-0.5 rounded text-xs bg-amber-900/50 text-amber-300 border border-amber-800'
                        }>
                          {p.payment_type === 'capitalized_interest' ? 'Capitalized' : p.payment_type.charAt(0).toUpperCase() + p.payment_type.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-300">{fmt(Math.abs(p.principal_amount))}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-300">{fmt(p.interest_amount)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{p.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}