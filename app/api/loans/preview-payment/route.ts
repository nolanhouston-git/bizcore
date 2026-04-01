import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import type { LoanRow, LoanPaymentRow, LoanWithHistory } from '@/lib/loanTypes'
import { applyWaterfallPayment } from '@/lib/loanCalculations'

const BUSINESS_ID = 1

function getLoansForMember(memberId: number): LoanWithHistory[] {
  // Get all active loans where the member is either lender or borrower
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
    WHERE l.business_id = ?
      AND l.deleted_at IS NULL
      AND (
        (l.lender_type = 'member' AND l.lender_id = ?)
        OR
        (l.borrower_type = 'member' AND l.borrower_id = ?)
      )
    ORDER BY l.interest_rate DESC
  `).all(BUSINESS_ID, memberId, memberId) as (LoanRow & {
    lenderDisplayName: string
    borrowerDisplayName: string
  })[]

  return loans.map(loan => {
    const payments = db.prepare(`
      SELECT * FROM loan_payments
      WHERE loan_id = ? AND deleted_at IS NULL
      ORDER BY payment_date ASC
    `).all(loan.id) as LoanPaymentRow[]

    const outstandingBalance = Math.round(
      payments.reduce((bal, p) => bal - p.principal_amount, loan.original_amount) * 100
    ) / 100

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

function getMemberIdForLoan(loanId: number): number | null {
  const loan = db.prepare(`
    SELECT lender_type, lender_id, borrower_type, borrower_id
    FROM loans WHERE id = ? AND deleted_at IS NULL
  `).get(loanId) as LoanRow | undefined

  if (!loan) return null
  if (loan.lender_type === 'member') return loan.lender_id
  if (loan.borrower_type === 'member') return loan.borrower_id
  return null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { loanId, paymentAmount, paymentDate, targetLoanId } = body

    if (!loanId || !paymentAmount || !paymentDate) {
      return NextResponse.json(
        { error: 'loanId, paymentAmount, and paymentDate are required' },
        { status: 400 }
      )
    }

    if (paymentAmount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be greater than zero' },
        { status: 400 }
      )
    }

    // Resolve which member this loan belongs to
    const memberId = getMemberIdForLoan(loanId)
    if (!memberId) {
      return NextResponse.json(
        { error: 'Loan not found' },
        { status: 404 }
      )
    }

    // Load all loans for this member — waterfall needs the full picture
    const loans = getLoansForMember(memberId)

    if (loans.length === 0) {
      return NextResponse.json(
        { error: 'No active loans found for this member' },
        { status: 404 }
      )
    }

    // Run the waterfall — pure calculation, no DB writes
    const result = applyWaterfallPayment(
      paymentAmount,
      loans,
      paymentDate,
      targetLoanId ?? undefined
    )

    return NextResponse.json(result)
  } catch (err) {
    console.error('preview-payment error:', err)
    return NextResponse.json(
      { error: 'Failed to calculate payment preview' },
      { status: 500 }
    )
  }
}