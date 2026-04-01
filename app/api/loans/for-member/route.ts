import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

const BUSINESS_ID = 1

export async function GET(req: NextRequest) {
  const memberId = parseInt(req.nextUrl.searchParams.get('memberId') ?? '0')
  const filterDirection = req.nextUrl.searchParams.get('filterDirection') === 'true'
  const transactionType = req.nextUrl.searchParams.get('transactionType') as 'expense' | 'income' | null

  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  try {
    const loans = db.prepare(`
      SELECT
        l.id,
        l.interest_rate,
        l.term_months,
        l.lender_type,
        l.borrower_type,
        l.original_amount,
        CASE l.lender_type
          WHEN 'member'   THEN bm_l.name
          WHEN 'business' THEN b_l.name
          ELSE 'External'
        END as lenderDisplayName,
        CASE l.borrower_type
          WHEN 'member'   THEN bm_b.name
          WHEN 'business' THEN b_b.name
          ELSE 'External'
        END as borrowerDisplayName,
        l.original_amount - COALESCE(
          SUM(CASE WHEN lp.deleted_at IS NULL THEN lp.principal_amount ELSE 0 END), 0
        ) as outstandingBalance
      FROM loans l
      LEFT JOIN business_members bm_l ON l.lender_type = 'member'    AND l.lender_id   = bm_l.id
      LEFT JOIN businesses       b_l  ON l.lender_type = 'business'  AND l.lender_id   = b_l.id
      LEFT JOIN business_members bm_b ON l.borrower_type = 'member'  AND l.borrower_id = bm_b.id
      LEFT JOIN businesses       b_b  ON l.borrower_type = 'business' AND l.borrower_id = b_b.id
      LEFT JOIN loan_payments    lp   ON lp.loan_id = l.id
      WHERE l.business_id = ?
        AND l.deleted_at IS NULL
        AND (
          (l.lender_type = 'member'   AND l.lender_id   = ?)
          OR
          (l.borrower_type = 'member' AND l.borrower_id = ?)
        )
      GROUP BY l.id
      HAVING outstandingBalance > 0
      ORDER BY l.interest_rate DESC
    `).all(BUSINESS_ID, memberId, memberId) as {
      id: number
      interest_rate: number
      term_months: number | null
      lender_type: string
      borrower_type: string
      lenderDisplayName: string
      borrowerDisplayName: string
      outstandingBalance: number
    }[]

    // If filterDirection is on, only return loans that make sense for the transaction type:
    // expense = business is borrower (repayment direction)
    // income  = business is lender (repayment direction)
    const filtered = filterDirection && transactionType
      ? loans.filter(l =>
          transactionType === 'expense'
            ? l.borrower_type === 'business'
            : l.lender_type === 'business'
        )
      : loans

    return NextResponse.json(filtered)
  } catch (err) {
    console.error('for-member error:', err)
    return NextResponse.json({ error: 'Failed to load loans' }, { status: 500 })
  }
}