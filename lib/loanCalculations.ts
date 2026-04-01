import type { LoanWithHistory, WaterfallAllocation, WaterfallResult } from './loanTypes'

// ── Leap year utilities ───────────────────────────────────────────────────────

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInYear(dateStr: string): number {
  const year = new Date(dateStr).getFullYear()
  return isLeapYear(year) ? 366 : 365
}

// For periods spanning a year boundary, returns the weighted average year
// length so interest is calculated correctly across the boundary.
function calcDayWeightedDenominator(fromStr: string, toStr: string): number {
  const from = new Date(fromStr)
  const to = new Date(toStr)
  const totalDays = Math.round((to.getTime() - from.getTime()) / 86400000)

  if (totalDays === 0) return daysInYear(fromStr)
  if (from.getFullYear() === to.getFullYear()) return daysInYear(fromStr)

  // Split at Jan 1 of the end year
  const splitPoint = new Date(to.getFullYear(), 0, 1)
  const daysInFirstPart = Math.round((splitPoint.getTime() - from.getTime()) / 86400000)
  const daysInSecondPart = totalDays - daysInFirstPart

  return (
    (daysInFirstPart * daysInYear(fromStr) + daysInSecondPart * daysInYear(toStr)) /
    totalDays
  )
}

// ── Core interest calculation ─────────────────────────────────────────────────

// Returns the interest owed for a given principal over a date range,
// using the correct formula for each compounding frequency.
export function calcInterestOwed(
  principal: number,
  annualRate: number,
  compoundingFrequency: string,
  fromDate: string,
  toDate: string
): number {
  const from = new Date(fromDate)
  const to = new Date(toDate)
  const days = Math.round((to.getTime() - from.getTime()) / 86400000)

  if (days <= 0 || principal <= 0 || annualRate <= 0) return 0

  const D = calcDayWeightedDenominator(fromDate, toDate)
  const t = days / D  // time in years, leap-year adjusted

  let interest: number

  switch (compoundingFrequency) {
    case 'simple':
      // No compounding — linear accrual on outstanding principal
      interest = principal * annualRate * t
      break

    case 'daily':
      interest = principal * (Math.pow(1 + annualRate / D, days) - 1)
      break

    case 'monthly':
      interest = principal * (Math.pow(1 + annualRate / 12, t * 12) - 1)
      break

    case 'quarterly':
      interest = principal * (Math.pow(1 + annualRate / 4, t * 4) - 1)
      break

    case 'semiannual':
      interest = principal * (Math.pow(1 + annualRate / 2, t * 2) - 1)
      break

    case 'annual':
      interest = principal * (Math.pow(1 + annualRate, t) - 1)
      break

    case 'continuous':
      // e^(rt) - 1 using Math.E for precision
      interest = principal * (Math.pow(Math.E, annualRate * t) - 1)
      break

    default:
      interest = principal * annualRate * t
  }

  // Round to cents
  return Math.round(interest * 100) / 100
}

// ── Segmented interest calculation ───────────────────────────────────────────

// When a loan has had advances between the last payment and now, the principal
// was not constant over the period. We split the period at each advance and
// calculate interest on each segment separately.
export function calcSegmentedInterest(
  loan: LoanWithHistory,
  asOfDate: string
): number {
  const payments = loan.payments
    .filter(p => p.deleted_at === null)
    .sort((a, b) => a.payment_date.localeCompare(b.payment_date))

  // Find the date of the last payment or advance (our period start)
  const lastActivity = payments.length > 0
    ? payments[payments.length - 1].payment_date
    : loan.start_date

  // Build segments: find all advances between lastActivity and asOfDate
  const advances = payments.filter(
    p => p.payment_type === 'advance' &&
         p.payment_date > lastActivity &&
         p.payment_date < asOfDate
  )

  if (advances.length === 0) {
    // Simple case: principal was constant over the entire period
    return calcInterestOwed(
      loan.outstandingPrincipal,
      loan.interest_rate,
      loan.compounding_frequency,
      lastActivity,
      asOfDate
    )
  }

  // Segmented case: calculate interest for each flat-principal segment
  let totalInterest = 0
  let segmentStart = lastActivity
  let runningPrincipal = loan.outstandingPrincipal

  // Walk backwards through advances to reconstruct principal at segment start
  // outstandingPrincipal already includes all advances, so we subtract them
  // to get the principal at lastActivity, then add back as we move forward
  const advanceTotal = advances.reduce((sum, a) => sum + Math.abs(a.principal_amount), 0)
  runningPrincipal = loan.outstandingPrincipal - advanceTotal

  for (const advance of advances) {
    totalInterest += calcInterestOwed(
      runningPrincipal,
      loan.interest_rate,
      loan.compounding_frequency,
      segmentStart,
      advance.payment_date
    )
    runningPrincipal += Math.abs(advance.principal_amount)
    segmentStart = advance.payment_date
  }

  // Final segment from last advance to asOfDate
  totalInterest += calcInterestOwed(
    runningPrincipal,
    loan.interest_rate,
    loan.compounding_frequency,
    segmentStart,
    asOfDate
  )

  return Math.round(totalInterest * 100) / 100
}

// ── Waterfall payment engine ──────────────────────────────────────────────────

export function applyWaterfallPayment(
  paymentAmount: number,
  loans: LoanWithHistory[],
  paymentDate: string,
  targetLoanId?: number
): WaterfallResult {
  const allocations: WaterfallAllocation[] = []
  let remaining = paymentAmount
  let totalCapitalized = 0

  // If targeting a specific loan, filter to just that one
  const workingLoans = targetLoanId
    ? loans.filter(l => l.id === targetLoanId)
    : [...loans].sort((a, b) => b.interest_rate - a.interest_rate)

  // For each loan: Pass 1 (cash interest) then Pass 2 (capitalized interest)
  // before moving to the next loan. Principal handled in a final pass.
  const principalAllocations: WaterfallAllocation[] = []

  for (const loan of workingLoans) {
    if (loan.outstandingBalance <= 0) continue

    const payments = loan.payments.filter(p => p.deleted_at === null)
    const lastActivity = payments.length > 0
      ? [...payments].sort((a, b) => a.payment_date.localeCompare(b.payment_date)).slice(-1)[0].payment_date
      : loan.start_date

    const days = Math.round(
      (new Date(paymentDate).getTime() - new Date(lastActivity).getTime()) / 86400000
    )

    // --- Pass 1: Cash interest owed on this loan ---
    const cashInterestOwed = calcSegmentedInterest(loan, paymentDate)

    if (cashInterestOwed > 0) {
      if (remaining >= cashInterestOwed) {
        // Fully cover cash interest
        allocations.push({
          loanId: loan.id,
          paymentType: 'payment',
          principalAmount: 0,
          interestAmount: cashInterestOwed,
          daysCovered: days,
          notes: 'Interest payment'
        })
        remaining = Math.round((remaining - cashInterestOwed) * 100) / 100
      } else {
        // Partial — cover what we can, capitalize the rest
        const covered = remaining
        const capitalized = Math.round((cashInterestOwed - covered) * 100) / 100

        if (covered > 0) {
          allocations.push({
            loanId: loan.id,
            paymentType: 'payment',
            principalAmount: 0,
            interestAmount: covered,
            daysCovered: days,
            notes: 'Partial interest payment'
          })
        }

        // Capitalized interest row — increases balance, deductible when later paid
        allocations.push({
          loanId: loan.id,
          paymentType: 'capitalized_interest',
          principalAmount: -capitalized,  // negative = increases balance
          interestAmount: 0,
          daysCovered: days,
          notes: 'Unpaid interest capitalized — deductible when paid in cash'
        })

        totalCapitalized += capitalized
        remaining = 0
      }
    }

    if (remaining <= 0) continue

    // --- Pass 2: Capitalized interest balance on this loan ---
    // Sum all prior capitalized_interest rows to find outstanding capitalized balance
    const capitalizedBalance = loan.payments
      .filter(p => p.deleted_at === null && p.payment_type === 'capitalized_interest')
      .reduce((sum, p) => sum + Math.abs(p.principal_amount), 0)

    if (capitalizedBalance > 0) {
      const toPay = Math.min(remaining, capitalizedBalance)
      allocations.push({
        loanId: loan.id,
        paymentType: 'payment',
        principalAmount: toPay,    // reduces the capitalized balance
        interestAmount: toPay,     // treated as interest for tax purposes — deductible
        daysCovered: days,
        notes: 'Capitalized interest payment — deductible'
      })
      remaining = Math.round((remaining - toPay) * 100) / 100
    }

    if (remaining <= 0) continue

    // Queue principal reduction — applied in final pass after all interest cleared
    principalAllocations.push({ loan, remaining: 0 } as any)
  }

  // --- Final pass: Principal reduction, highest rate first ---
  for (const loan of workingLoans) {
    if (remaining <= 0) break
    if (loan.outstandingBalance <= 0) continue

    // Outstanding original principal = total balance minus capitalized interest
    const capitalizedBalance = loan.payments
      .filter(p => p.deleted_at === null && p.payment_type === 'capitalized_interest')
      .reduce((sum, p) => sum + Math.abs(p.principal_amount), 0)

    const payments = loan.payments.filter(p => p.deleted_at === null)
    const days = payments.length > 0
      ? Math.round(
          (new Date(paymentDate).getTime() -
           new Date([...payments].sort((a, b) => a.payment_date.localeCompare(b.payment_date)).slice(-1)[0].payment_date).getTime()
          ) / 86400000
        )
      : Math.round(
          (new Date(paymentDate).getTime() - new Date(loan.start_date).getTime()) / 86400000
        )

    const originalPrincipalBalance = Math.max(0, loan.outstandingBalance - capitalizedBalance)
    if (originalPrincipalBalance <= 0) continue

    const toPay = Math.min(remaining, originalPrincipalBalance)
    allocations.push({
      loanId: loan.id,
      paymentType: 'payment',
      principalAmount: toPay,
      interestAmount: 0,
      daysCovered: days,
      notes: 'Principal reduction'
    })
    remaining = Math.round((remaining - toPay) * 100) / 100
  }

  const overpayment = remaining > 0 ? Math.round(remaining * 100) / 100 : 0
  const underpayment = totalCapitalized > 0 ? totalCapitalized : 0

  return {
    allocations,
    overpayment,
    underpayment,
    capitalizedAmount: totalCapitalized
  }
}