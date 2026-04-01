'use server'

import db from '@/lib/db'
import type { WaterfallAllocation } from '@/lib/loanTypes'

const BUSINESS_ID = 1

export async function addLoan(formData: FormData): Promise<{ error: string | null }> {
  try {
    const direction = formData.get('direction') as string
    const memberId = parseInt(formData.get('memberId') as string)
    const businessId = parseInt(formData.get('businessId') as string)
    const originalAmount = parseFloat(formData.get('originalAmount') as string)
    const interestRate = parseFloat(formData.get('interestRate') as string) / 100
    const compoundingFrequency = formData.get('compoundingFrequency') as string
    const termMonthsRaw = formData.get('termMonths') as string
    const termMonths = termMonthsRaw ? parseInt(termMonthsRaw) : null
    const startDate = formData.get('startDate') as string
    const notes = (formData.get('notes') as string) || null

    if (!memberId || isNaN(originalAmount) || isNaN(interestRate)) {
      return { error: 'Please fill in all required fields' }
    }

    if (originalAmount <= 0) {
      return { error: 'Amount must be greater than zero' }
    }

    if (interestRate < 0) {
      return { error: 'Interest rate cannot be negative' }
    }

    const lenderType = direction === 'member_to_business' ? 'member' : 'business'
    const lenderId   = direction === 'member_to_business' ? memberId : businessId
    const borrowerType = direction === 'member_to_business' ? 'business' : 'member'
    const borrowerId   = direction === 'member_to_business' ? businessId : memberId

    db.prepare(`
      INSERT INTO loans (
        business_id, lender_type, lender_id, borrower_type, borrower_id,
        original_amount, interest_rate, compounding_frequency,
        term_months, start_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      BUSINESS_ID, lenderType, lenderId, borrowerType, borrowerId,
      originalAmount, interestRate, compoundingFrequency,
      termMonths, startDate, notes
    )

    return { error: null }
  } catch (err) {
    console.error('addLoan error:', err)
    return { error: 'Failed to save loan' }
  }
}

export async function recordPayment(params: {
  loanId: number
  allocations: WaterfallAllocation[]
  paymentDate: string
  notes: string
}): Promise<{ error: string | null }> {
  try {
    const { loanId, allocations, paymentDate, notes } = params

    if (!allocations || allocations.length === 0) {
      return { error: 'No payment allocations to record' }
    }

    // Insert all allocation rows in a single atomic transaction
    const insertMany = db.transaction(() => {
      for (const a of allocations) {
        db.prepare(`
          INSERT INTO loan_payments (
            business_id, loan_id, payment_date, payment_type,
            principal_amount, interest_amount, days_covered, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          BUSINESS_ID,
          a.loanId ?? loanId,
          paymentDate,
          a.paymentType,
          a.principalAmount,
          a.interestAmount,
          a.daysCovered,
          notes || a.notes || null
        )
      }
    })

    insertMany()
    return { error: null }
  } catch (err) {
    console.error('recordPayment error:', err)
    return { error: 'Failed to record payment' }
  }
}

export async function amendLoan(
  formData: FormData,
  originalLoan: import('@/lib/loanTypes').LoanWithHistory
): Promise<{ error: string | null }> {
  try {
    const reason = (formData.get('reason') as string)?.trim()
    if (!reason) return { error: 'A reason for the change is required' }

    const fields: Array<{
      key: keyof import('@/lib/loanTypes').LoanRow
      formKey: string
      parse: (v: string) => string
    }> = [
      { key: 'interest_rate',         formKey: 'interestRate',         parse: v => String(parseFloat(v) / 100) },
      { key: 'compounding_frequency', formKey: 'compoundingFrequency', parse: v => v },
      { key: 'term_months',           formKey: 'termMonths',           parse: v => v ? String(parseInt(v)) : '' },
      { key: 'start_date',            formKey: 'startDate',            parse: v => v },
      { key: 'notes',                 formKey: 'notes',                parse: v => v },
    ]

    const amendments: Array<{ field: string; oldValue: string; newValue: string }> = []

    for (const f of fields) {
      const raw = (formData.get(f.formKey) as string) ?? ''
      const newValue = f.parse(raw)
      const oldValue = String(originalLoan[f.key] ?? '')

      if (newValue !== oldValue) {
        amendments.push({ field: f.key, oldValue, newValue })
      }
    }

    if (amendments.length === 0) {
      return { error: 'No changes detected' }
    }

    const applyAmendments = db.transaction(() => {
      for (const a of amendments) {
        // Write to amendment log
        db.prepare(`
          INSERT INTO loan_amendments (business_id, loan_id, field_changed, old_value, new_value, reason)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(BUSINESS_ID, originalLoan.id, a.field, a.oldValue, a.newValue, reason)

        // Apply change to loans table
        db.prepare(`UPDATE loans SET ${a.field} = ? WHERE id = ?`).run(
          a.newValue === '' ? null : a.newValue,
          originalLoan.id
        )
      }
    })

    applyAmendments()
    return { error: null }
  } catch (err) {
    console.error('amendLoan error:', err)
    return { error: 'Failed to save amendment' }
  }
}

export async function deleteLoan(
  loanId: number,
  reason: string
): Promise<{ error: string | null }> {
  try {
    if (!reason?.trim()) return { error: 'A reason is required to delete a loan' }

    const loan = db.prepare(
      'SELECT * FROM loans WHERE id = ? AND deleted_at IS NULL'
    ).get(loanId) as import('@/lib/loanTypes').LoanRow | undefined

    if (!loan) return { error: 'Loan not found' }

    const performDelete = db.transaction(() => {
      // Log deletion to amendment audit trail
      db.prepare(`
        INSERT INTO loan_amendments (business_id, loan_id, field_changed, old_value, new_value, reason)
        VALUES (?, ?, 'deleted', 'active', 'deleted', ?)
      `).run(BUSINESS_ID, loanId, reason.trim())

      // Soft-delete all payments for this loan
      db.prepare(`
        UPDATE loan_payments SET deleted_at = datetime('now')
        WHERE loan_id = ? AND deleted_at IS NULL
      `).run(loanId)

      // Soft-delete the loan itself
      db.prepare(`
        UPDATE loans SET deleted_at = datetime('now') WHERE id = ?
      `).run(loanId)
    })

    performDelete()
    return { error: null }
  } catch (err) {
    console.error('deleteLoan error:', err)
    return { error: 'Failed to delete loan' }
  }
}