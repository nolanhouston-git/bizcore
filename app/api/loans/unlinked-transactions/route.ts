import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

const BUSINESS_ID = 1

type UnlinkedRow = {
  id: number
  date: string
  description: string
  merchant_name: string | null
  amount: number
  table: 'expenses' | 'income'
}

export async function GET(req: NextRequest) {
  // loanDirection: 'business_borrower' = member lent to business
  //                'business_lender'   = business lent to member
  const loanDirection = req.nextUrl.searchParams.get('loanDirection') as
    | 'business_borrower'
    | 'business_lender'
    | null

  // When loan direction is known:
  // business_borrower (member→business): expenses are repayments, income are disbursements
  //   → show expenses only
  // business_lender (business→member): income are repayments, expenses are disbursements
  //   → show income only
  // No direction provided: show both
  const includeExpenses = !loanDirection || loanDirection === 'business_borrower'
  const includeIncome   = !loanDirection || loanDirection === 'business_lender'

  const expenses = includeExpenses
    ? db.prepare(`
        SELECT id, date, description, merchant_name, amount, 'expenses' as tbl
        FROM expenses
        WHERE business_id = ?
          AND deleted_at IS NULL
          AND category = 'Loan Transaction'
          AND linked_loan_id IS NULL
        ORDER BY date DESC, id DESC
      `).all(BUSINESS_ID) as (Omit<UnlinkedRow, 'table'> & { tbl: string })[]
    : []

  const income = includeIncome
    ? db.prepare(`
        SELECT id, date, description, merchant_name, amount, 'income' as tbl
        FROM income
        WHERE business_id = ?
          AND deleted_at IS NULL
          AND category = 'Loan Transaction'
          AND linked_loan_id IS NULL
        ORDER BY date DESC, id DESC
      `).all(BUSINESS_ID) as (Omit<UnlinkedRow, 'table'> & { tbl: string })[]
    : []

  const combined: UnlinkedRow[] = [
    ...expenses.map(r => ({ ...r, table: 'expenses' as const })),
    ...income.map(r => ({ ...r, table: 'income' as const })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1))

  return NextResponse.json(combined)
}
