import db from '@/lib/db'
import { formatDate, type DateFormatKey } from '@/lib/dateFormat'
import Link from 'next/link'

const BUSINESS_ID = 1

type AmendmentRow = {
  id: number
  loan_id: number
  field_changed: string
  old_value: string
  new_value: string
  reason: string
  amended_at: string
  lenderDisplayName: string
  borrowerDisplayName: string
}

function getAmendments(): AmendmentRow[] {
  return db.prepare(`
    SELECT la.*,
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
    FROM loan_amendments la
    JOIN loans l ON la.loan_id = l.id
    LEFT JOIN business_members bm_lender
      ON l.lender_type = 'member' AND l.lender_id = bm_lender.id
    LEFT JOIN businesses b_lender
      ON l.lender_type = 'business' AND l.lender_id = b_lender.id
    LEFT JOIN business_members bm_borrower
      ON l.borrower_type = 'member' AND l.borrower_id = bm_borrower.id
    LEFT JOIN businesses b_borrower
      ON l.borrower_type = 'business' AND l.borrower_id = b_borrower.id
    WHERE la.business_id = ?
    ORDER BY la.amended_at DESC
  `).all(BUSINESS_ID) as AmendmentRow[]
}

function getSetting(key: string): string | null {
  const row = db.prepare(
    `SELECT value FROM settings WHERE business_id = ? AND key = ?`
  ).get(BUSINESS_ID, key) as { value: string } | undefined
  return row?.value ?? null
}

function formatFieldName(field: string): string {
  const map: Record<string, string> = {
    interest_rate:         'Interest Rate',
    compounding_frequency: 'Compounding',
    term_months:           'Term (months)',
    start_date:            'Start Date',
    notes:                 'Notes',
  }
  return map[field] ?? field
}

function formatFieldValue(field: string, value: string): string {
  if (!value || value === 'null') return '—'
  if (field === 'interest_rate') return (parseFloat(value) * 100).toFixed(2) + '%'
  if (field === 'compounding_frequency') {
    const map: Record<string, string> = {
      simple: 'Simple', daily: 'Daily', monthly: 'Monthly',
      quarterly: 'Quarterly', semiannual: 'Semiannual',
      annual: 'Annual', continuous: 'Continuous'
    }
    return map[value] ?? value
  }
  if (field === 'term_months') return value ? `${value} months` : 'Open-ended'
  return value
}

export default function LoanHistoryPage() {
  const amendments = getAmendments()
  const dateFormat = (getSetting('date_format') ?? 'Mon DD, YYYY') as DateFormatKey

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Loan Amendment History</h1>
            <p className="text-gray-400 text-sm mt-1">
              Full audit trail of all changes to loan terms
            </p>
          </div>
          <Link
            href="/loans"
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
          >
            ← Back to Register
          </Link>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
          <Link
            href="/loans"
            className="px-4 py-2 rounded-md text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Register
          </Link>
          <span className="px-4 py-2 rounded-md text-sm bg-gray-700 text-white font-medium">
            History
          </span>
        </div>

        {/* Amendment table */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          {amendments.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No amendments recorded yet. Changes to loan terms will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Loan</th>
                    <th className="px-4 py-3 text-left">Field</th>
                    <th className="px-4 py-3 text-left">Previous Value</th>
                    <th className="px-4 py-3 text-left">New Value</th>
                    <th className="px-4 py-3 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {amendments.map(a => (
                    <tr key={a.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                        {formatDate(a.amended_at.split(' ')[0], dateFormat)}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {a.lenderDisplayName} → {a.borrowerDisplayName}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300 border border-gray-700">
                          {formatFieldName(a.field_changed)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-red-400/80 text-xs">
                        {formatFieldValue(a.field_changed, a.old_value)}
                      </td>
                      <td className="px-4 py-3 font-mono text-green-400/80 text-xs">
                        {formatFieldValue(a.field_changed, a.new_value)}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-xs">
                        {a.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}