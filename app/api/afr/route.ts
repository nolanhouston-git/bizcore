import { NextResponse } from 'next/server'
import db from '@/lib/db'

const BUSINESS_ID = 1
const CACHE_KEY = 'afr_rates'

// IRS Revenue Ruling PDF URL pattern
// Published monthly around the 20th of the preceding month
// Format: rr-YY-MM.pdf where YY is 2-digit year, MM is 2-digit month
function buildIrsUrl(year: number, month: number): string {
  const yy = String(year).slice(2)
  const mm = String(month).padStart(2, '0')
  return `https://www.irs.gov/pub/irs-drop/rr-${yy}-${mm}.pdf`
}

// Extract AFR rates from raw PDF text
// Looks for Table 1 and pulls short-term, mid-term, long-term annual rates
function parseAfrRates(text: string): {
  short: number
  mid: number
  long: number
} | null {
  try {
    // Normalize whitespace
    const normalized = text.replace(/\s+/g, ' ')

    // Find Table 1 section
    const table1Start = normalized.indexOf('TABLE 1')
    if (table1Start === -1) return null
    const table1End = normalized.indexOf('TABLE 2', table1Start)
    const table1 = normalized.slice(table1Start, table1End === -1 ? undefined : table1End)

    // Extract rates — Table 1 lists Annual, Semiannual, Quarterly, Monthly
    // for Short-term, Mid-term, Long-term. We want the Annual column (first number after AFR)
    // Pattern: "AFR X.XX% ..." where X.XX is the annual rate
    const shortMatch = table1.match(/Short-term\s+AFR\s+([\d.]+)%/)
    const midMatch   = table1.match(/Mid-term\s+AFR\s+([\d.]+)%/)
    const longMatch  = table1.match(/Long-term\s+AFR\s+([\d.]+)%/)

    if (!shortMatch || !midMatch || !longMatch) return null

    return {
      short: Math.round(parseFloat(shortMatch[1]) / 100 * 10000) / 10000,
      mid:   Math.round(parseFloat(midMatch[1])   / 100 * 10000) / 10000,
      long:  Math.round(parseFloat(longMatch[1])  / 100 * 10000) / 10000,
    }
  } catch {
    return null
  }
}

async function fetchAfrForMonth(year: number, month: number): Promise<{
  short: number
  mid: number
  long: number
} | null> {
  const url = buildIrsUrl(year, month)

  try {
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) return null

    const arrayBuffer = await res.arrayBuffer()

    // Dynamic import — pdfjs-dist uses browser globals internally,
    // dynamic import + disabling the worker makes it safe for server-side use
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/root/bizcore/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'

    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise

    let fullText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ')
      fullText += pageText + ' '
    }

    return parseAfrRates(fullText)
  } catch {
    return null
  }
}

export async function GET() {
  try {
    // Check cache first — AFR only changes monthly
    const cached = db.prepare(
      `SELECT value, updated_at FROM settings
       WHERE business_id = ? AND key = ?`
    ).get(BUSINESS_ID, CACHE_KEY) as { value: string; updated_at: string } | undefined

    if (cached) {
      const updatedAt = new Date(cached.updated_at)
      const now = new Date()
      const sameMonth =
        updatedAt.getFullYear() === now.getFullYear() &&
        updatedAt.getMonth() === now.getMonth()

      if (sameMonth) {
        const rates = JSON.parse(cached.value)
        return NextResponse.json({ ...rates, cached: true })
      }
    }

    // Fetch current month — if not yet published, fall back to previous month
    const now = new Date()
    let rates = await fetchAfrForMonth(now.getFullYear(), now.getMonth() + 1)

    let monthUsed = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    if (!rates) {
      // Try previous month
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      rates = await fetchAfrForMonth(prev.getFullYear(), prev.getMonth() + 1)
      monthUsed = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
    }

    if (!rates) {
      // Both months failed — return hardcoded fallback with a flag
      // Based on January 2026 IRS Revenue Ruling 2026-2
      return NextResponse.json({
        short: 0.0363,
        mid:   0.0381,
        long:  0.0463,
        month: 'fallback',
        cached: false,
        fallback: true,
      })
    }

    // Cache the result
    const value = JSON.stringify({ ...rates, month: monthUsed })
    db.prepare(
      `INSERT INTO settings (business_id, key, value, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(business_id, key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`
    ).run(BUSINESS_ID, CACHE_KEY, value)

    return NextResponse.json({ ...rates, month: monthUsed, cached: false })

  } catch (err) {
    console.error('AFR fetch error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch AFR rates' },
      { status: 500 }
    )
  }
}