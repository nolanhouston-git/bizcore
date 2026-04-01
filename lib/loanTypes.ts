// ── Raw database row types ────────────────────────────────────────────────────

export type LoanPaymentRow = {
  id: number
  business_id: number
  loan_id: number
  payment_date: string
  payment_type: 'payment' | 'advance' | 'capitalized_interest'
  principal_amount: number
  interest_amount: number
  days_covered: number | null
  notes: string | null
  created_at: string
  deleted_at: string | null
}

export type LoanRow = {
  id: number
  business_id: number
  lender_type: 'member' | 'business' | 'external'
  lender_id: number
  borrower_type: 'member' | 'business' | 'external'
  borrower_id: number
  original_amount: number
  interest_rate: number
  compounding_frequency: 'annual' | 'semiannual' | 'quarterly' | 'monthly' | 'daily' | 'continuous' | 'simple'
  term_months: number | null
  start_date: string
  payment_amount: number | null
  notes: string | null
  created_at: string
  deleted_at: string | null
}

// ── Enriched types used by loanCalculations.ts ────────────────────────────────

// A loan row enriched with its full payment history and calculated balances.
// Built by the server page query before being passed to the waterfall.
export type LoanWithHistory = LoanRow & {
  payments: LoanPaymentRow[]
  outstandingBalance: number    // total balance including capitalized interest
  outstandingPrincipal: number  // original principal portion only
  lenderDisplayName: string
  borrowerDisplayName: string
}

// ── Waterfall result types ────────────────────────────────────────────────────

export type WaterfallAllocation = {
  loanId: number
  paymentType: 'payment' | 'capitalized_interest'
  principalAmount: number
  interestAmount: number
  daysCovered: number
  notes: string
}

export type WaterfallResult = {
  allocations: WaterfallAllocation[]
  overpayment: number       // payment exceeded all balances — needs user confirmation
  underpayment: number      // interest not fully covered — will be capitalized
  capitalizedAmount: number // total interest being capitalized this payment
}