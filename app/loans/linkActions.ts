'use server'

import db from '@/lib/db'
import { revalidatePath } from 'next/cache'
import type { WaterfallAllocation } from '@/lib/loanTypes'

const BUSINESS_ID = 1

// ─── Types ────────────────────────────────────────────────────────────────────

type LedgerTable = 'expenses' | 'income'

export type LinkParams = {
  txId: number
  table: LedgerTable
  txDate: string
  transactionType: 'expense' | 'income'
  allocations: WaterfallAllocation[]
  notes?: string
}

export type RelinkParams = LinkParams & {
  previousAllocations: WaterfallAllocation[]
  previousLoanId: number
}

export type UnlinkParams = {
  txId: number
  table: LedgerTable
  txDate: string
  previousAllocations: WaterfallAllocation[]
  previousLoanId: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function writeLoanPayments(
  allocations: WaterfallAllocation[],
  txDate: string,
  notes: string | null,
  transactionType: 'expense' | 'income'
) {
  for (const a of allocations) {
    // Look up loan direction to determine correct payment type
    const loan = db.prepare(
      `SELECT borrower_type FROM loans WHERE id = ? AND deleted_at IS NULL`
    ).get(a.loanId) as { borrower_type: string } | undefined

    const businessIsBorrower = loan?.borrower_type === 'business'

    // Determine if this transaction is an advance (increases balance) or payment (reduces balance)
    // expense + business-is-borrower = repayment (payment) ✅
    // income  + business-is-lender   = repayment (payment) ✅
    // income  + business-is-borrower = advance from member  ❌ increases balance
    // expense + business-is-lender   = advance to member    ❌ increases balance
    const isAdvance =
      (transactionType === 'income' && businessIsBorrower) ||
      (transactionType === 'expense' && !businessIsBorrower)

    const paymentType = isAdvance ? 'advance' : a.paymentType
    const principalAmount = isAdvance ? -Math.abs(a.principalAmount) : a.principalAmount

    db.prepare(`
      INSERT INTO loan_payments (
        business_id, loan_id, payment_date, payment_type,
        principal_amount, interest_amount, days_covered, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      BUSINESS_ID,
      a.loanId,
      txDate,
      paymentType,
      principalAmount,
      a.interestAmount,
      a.daysCovered,
      notes ?? a.notes ?? null
    )
  }
}

function softDeletePaymentsForTx(txDate: string, loanIds: number[]) {
  // Soft-delete loan_payments rows that were written for a specific tx.
  // Scoped by loan_id + payment_date to avoid touching unrelated payments.
  for (const loanId of loanIds) {
    db.prepare(`
      UPDATE loan_payments
      SET deleted_at = datetime('now')
      WHERE business_id = ?
        AND loan_id = ?
        AND payment_date = ?
        AND deleted_at IS NULL
    `).run(BUSINESS_ID, loanId, txDate)
  }
}

function logAmendment(
  loanId: number,
  fieldChanged: string,
  oldValue: string,
  newValue: string,
  reason: string
) {
  db.prepare(`
    INSERT INTO loan_amendments (business_id, loan_id, field_changed, old_value, new_value, reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(BUSINESS_ID, loanId, fieldChanged, oldValue, newValue, reason)
}

// ─── Server Actions ───────────────────────────────────────────────────────────

export async function linkTransactionToLoan(
  params: LinkParams
): Promise<{ error: string | null }> {
  try {
    const { txId, table, txDate, transactionType, allocations, notes } = params

    // Pre-flight: bail if this row is already linked
    const existing = db.prepare(
      `SELECT linked_loan_id FROM ${table} WHERE id = ? AND business_id = ?`
    ).get(txId, BUSINESS_ID) as { linked_loan_id: number | null } | undefined

    if (existing?.linked_loan_id != null) {
      return { error: 'This transaction is already linked to a loan' }
    }

    if (!allocations || allocations.length === 0) {
      return { error: 'No allocations provided' }
    }

    // Primary loan for the badge — first allocation's loanId
    const primaryLoanId = allocations[0].loanId

    if (table !== 'expenses' && table !== 'income') throw new Error(`Invalid table: ${table}`)

    const perform = db.transaction(() => {
      // 1. Write loan_payments rows
      writeLoanPayments(allocations, txDate, notes ?? null, transactionType)

      // 2. Update the ledger row — set category and linked_loan_id
      db.prepare(`
        UPDATE ${table}
        SET category = 'Loan Transaction',
            linked_loan_id = ?
        WHERE id = ? AND business_id = ?
      `).run(primaryLoanId, txId, BUSINESS_ID)
    })

    perform()

    revalidatePath('/expenses')
    revalidatePath('/income')
    revalidatePath('/loans')
    return { error: null }
  } catch (err) {
    console.error('linkTransactionToLoan error:', err)
    return { error: 'Failed to link transaction' }
  }
}

export async function relinkTransaction(
  params: RelinkParams
): Promise<{ error: string | null }> {
  try {
    const {
      txId, table, txDate,
      transactionType, allocations, notes,
      previousAllocations, previousLoanId,
    } = params

    if (!allocations || allocations.length === 0) {
      return { error: 'No allocations provided' }
    }

    const primaryLoanId = allocations[0].loanId
    const previousLoanIds = [...new Set(previousAllocations.map(a => a.loanId))]

    if (table !== 'expenses' && table !== 'income') throw new Error(`Invalid table: ${table}`)

    const perform = db.transaction(() => {
      // 1. Soft-delete previous loan_payments rows
      softDeletePaymentsForTx(txDate, previousLoanIds)

      // 2. Log the relink in loan_amendments against the primary previous loan
      logAmendment(
        previousLoanId,
        'relinked',
        `tx_id:${txId}`,
        `tx_id:${txId}`,
        `Transaction re-linked. Previous allocations reversed. New primary loan: ${primaryLoanId}.`
      )

      // 3. Write new loan_payments rows
      writeLoanPayments(allocations, txDate, notes ?? null, transactionType)

      // 4. Update the ledger row with new primary loan
      db.prepare(`
        UPDATE ${table}
        SET category = 'Loan Transaction',
            linked_loan_id = ?
        WHERE id = ? AND business_id = ?
      `).run(primaryLoanId, txId, BUSINESS_ID)
    })

    perform()

    revalidatePath('/expenses')
    revalidatePath('/income')
    revalidatePath('/loans')
    return { error: null }
  } catch (err) {
    console.error('relinkTransaction error:', err)
    return { error: 'Failed to re-link transaction' }
  }
}

export async function unlinkTransaction(
  params: UnlinkParams
): Promise<{ error: string | null }> {
  try {
    const { txId, table, txDate, previousAllocations, previousLoanId } = params

    const previousLoanIds = [...new Set(previousAllocations.map(a => a.loanId))]

    if (table !== 'expenses' && table !== 'income') throw new Error(`Invalid table: ${table}`)

    const perform = db.transaction(() => {
      // 1. Soft-delete previous loan_payments rows
      softDeletePaymentsForTx(txDate, previousLoanIds)

      // 2. Log the unlink in loan_amendments
      logAmendment(
        previousLoanId,
        'unlinked',
        `tx_id:${txId}`,
        'none',
        'Transaction unlinked from loan. Payments reversed.'
      )

      // 3. Clear loan link on the ledger row, reset category to Other
      db.prepare(`
        UPDATE ${table}
        SET category = 'Other',
            linked_loan_id = NULL
        WHERE id = ? AND business_id = ?
      `).run(txId, BUSINESS_ID)
    })

    perform()

    revalidatePath('/expenses')
    revalidatePath('/income')
    revalidatePath('/loans')
    return { error: null }
  } catch (err) {
    console.error('unlinkTransaction error:', err)
    return { error: 'Failed to unlink transaction' }
  }
}