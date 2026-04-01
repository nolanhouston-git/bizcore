import sqlite from "./index";

// ── Businesses ────────────────────────────────────────────────────────────────
const existingBusiness = sqlite.prepare("SELECT id FROM businesses LIMIT 1").get();

if (!existingBusiness) {
  sqlite.prepare(`
    INSERT INTO businesses (name, dba, industry, structure, city, state, county)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    "Psyche Strategy LLC",
    "Psyche",
    "Market Research",
    "Multi-member LLC taxed as S-Corporation",
    "Seattle",
    "WA",
    "King County"
  );
  console.log("✓ Seeded: Psyche Strategy LLC");
} else {
  console.log("Business already exists — skipping");
}

// ── Expenses ──────────────────────────────────────────────────────────────────
const existingExpenses = sqlite.prepare("SELECT id FROM expenses LIMIT 1").get();

if (!existingExpenses) {
  const insertExpense = sqlite.prepare(`
    INSERT INTO expenses (business_id, date, description, merchant_name, amount, category, status, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const expenses = [
    [1, "2026-03-01", "Office Rent — March",         null,          2200.00, "Rent",       "approved", "manual"],
    [1, "2026-03-02", "GUSTO PAYROLL",                "Gusto",       8500.00, "Payroll",    "approved", "gusto"],
    [1, "2026-03-03", "ADOBE SYSTEMS INC",            "Adobe",         89.99, "Software",   "approved", "bank"],
    [1, "2026-03-05", "Office Supplies — Staples",    null,           143.50, "Supplies",   "pending",  "manual"],
    [1, "2026-03-06", "GOOGLE ADS",                   "Google",       450.00, "Marketing",  "approved", "bank"],
    [1, "2026-03-07", "SEATTLE CITY LIGHT",           null,           310.00, "Utilities",  "approved", "bank"],
    [1, "2026-03-08", "QUALTRICS INTERNATIONAL",      "Qualtrics",    299.00, "Research",   "approved", "bank"],
    [1, "2026-03-08", "ZOOM COMMUNICATIONS",          "Zoom",         149.90, "Software",   "approved", "bank"],
    [1, "2026-03-09", "RESPONDENT IO",                "Respondent", 1200.00,  "Research",   "pending",  "bank"],
    [1, "2026-03-10", "PACIFIC PREMIER BANK FEE",     null,            25.00, "Banking",    "approved", "bank"],
  ];

  for (const expense of expenses) {
    insertExpense.run(...expense);
  }
  console.log("✓ Seeded: 10 sample expenses");
} else {
  console.log("Expenses already exist — skipping");
}

// ── Income ────────────────────────────────────────────────────────────────────
const existingIncome = sqlite.prepare("SELECT id FROM income LIMIT 1").get();

if (!existingIncome) {
  const insertIncome = sqlite.prepare(`
    INSERT INTO income (business_id, date, description, merchant_name, amount, category, status, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const incomeRecords = [
    [1, "2026-03-01", "Q1 Research Project — Acme Corp",       "Acme Corp",      12500.00, "Research Project", "approved", "manual"],
    [1, "2026-03-05", "Retainer Fee — March",                  null,              3500.00, "Retainer",         "approved", "manual"],
    [1, "2026-03-08", "Consulting — Brand Strategy Session",   null,              2200.00, "Consulting",       "approved", "manual"],
    [1, "2026-03-12", "Pharma Study — Participant Recruiting",  "MedInsight LLC", 8750.00, "Research Project", "approved", "bank"],
    [1, "2026-03-15", "Expense Reimbursement — Client Travel",  null,              487.60, "Reimbursement",    "pending",  "manual"],
    [1, "2026-03-18", "Segmentation Study — TechCo",           "TechCo",          6000.00, "Research Project", "pending",  "manual"],
  ];

  for (const record of incomeRecords) {
    insertIncome.run(...record);
  }
  console.log("✓ Seeded: 6 sample income records");
} else {
  console.log("Income already exists — skipping");
}

// ── Tax Rules — 2026 S-Corp ───────────────────────────────────────────────────
const existingTaxRules = sqlite.prepare("SELECT id FROM tax_rules LIMIT 1").get();

if (!existingTaxRules) {
  const insertRule = sqlite.prepare(`
    INSERT INTO tax_rules
      (entity_type, rule_key, rule_value, tax_year, label, description, source_url)
    VALUES
      (?, ?, ?, ?, ?, ?, ?)
  `);

  const rules = [
    [
      "scorp", "fica_employer_rate", "0.0765", 2026,
      "Employer FICA Rate",
      "Employer share of Social Security (6.2%) + Medicare (1.45%). Paid on each employee's wages.",
      "https://www.irs.gov/taxtopics/tc751",
    ],
    [
      "scorp", "fica_employee_rate", "0.0765", 2026,
      "Employee FICA Rate",
      "Employee share of Social Security (6.2%) + Medicare (1.45%). Withheld from W-2 wages.",
      "https://www.irs.gov/taxtopics/tc751",
    ],
    [
      "scorp", "futa_rate", "0.006", 2026,
      "FUTA Rate (net)",
      "Federal Unemployment Tax Act rate after the standard 5.4% state credit. Applied to first $7,000 of each employee's wages.",
      "https://www.irs.gov/taxtopics/tc759",
    ],
    [
      "scorp", "futa_wage_base", "7000", 2026,
      "FUTA Wage Base",
      "FUTA applies only to the first $7,000 of wages paid to each employee per year.",
      "https://www.irs.gov/taxtopics/tc759",
    ],
    [
      "scorp", "wa_sui_rate", "0.01", 2026,
      "WA State Unemployment Insurance Rate",
      "Washington State UI rate varies by employer experience. 1% is a reasonable estimate for a small employer. Verify with WA ESD.",
      "https://esd.wa.gov/employer-taxes/tax-rates",
    ],
    [
      "scorp", "wa_sui_wage_base", "67600", 2026,
      "WA SUI Wage Base",
      "WA unemployment insurance applies to the first $67,600 of wages per employee in 2026.",
      "https://esd.wa.gov/employer-taxes/tax-rates",
    ],
    [
      "scorp", "wa_bo_professional_rate", "0.015", 2026,
      "WA B&O Rate — Professional Services",
      "Washington B&O tax rate for professional services, including market research. Applied to gross receipts.",
      "https://dor.wa.gov/taxes-rates/business-occupation-tax",
    ],
    [
      "scorp", "seattle_bo_rate", "0.00415", 2026,
      "Seattle B&O Rate",
      "City of Seattle Business & Occupation tax rate for professional services. Applied to gross receipts.",
      "https://seattle.gov/license-and-tax-administration/business-license-tax",
    ],
    [
      "scorp", "standard_deduction_mfj", "30000", 2026,
      "Standard Deduction — Married Filing Jointly",
      "2026 MFJ standard deduction (approximate — confirm when IRS publishes final figures).",
      "https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2026",
    ],
    [
      "scorp", "ss_wage_base", "176100", 2026,
      "Social Security Wage Base",
      "Social Security tax (6.2% employee + 6.2% employer) applies only to wages up to this amount. Medicare has no wage base cap.",
      "https://www.ssa.gov/oact/cola/cbb.html",
    ],
  ];

  for (const rule of rules) {
    insertRule.run(...rule);
  }
  console.log("✓ Seeded: 10 tax rules (2026 S-Corp)");
} else {
  console.log("Tax rules already exist — skipping");
}

// ── Tax Brackets — 2026 MFJ ───────────────────────────────────────────────────
const existingBrackets = sqlite.prepare("SELECT id FROM tax_brackets LIMIT 1").get();

if (!existingBrackets) {
  const insertBracket = sqlite.prepare(`
    INSERT INTO tax_brackets (filing_type, tax_year, bracket_min, bracket_max, rate)
    VALUES (?, ?, ?, ?, ?)
  `);

  // 2026 Married Filing Jointly federal income tax brackets
  // bracket_max NULL = top bracket (no ceiling)
  const brackets = [
    ["mfj", 2026,      0,  23850, 0.10],
    ["mfj", 2026,  23850,  96950, 0.12],
    ["mfj", 2026,  96950, 206700, 0.22],
    ["mfj", 2026, 206700, 394600, 0.24],
    ["mfj", 2026, 394600, 501050, 0.32],
    ["mfj", 2026, 501050, 751600, 0.35],
    ["mfj", 2026, 751600,   null, 0.37],
  ];

  for (const bracket of brackets) {
    insertBracket.run(...bracket);
  }
  console.log("✓ Seeded: 7 tax brackets (2026 MFJ)");
} else {
  console.log("Tax brackets already exist — skipping");
}

// ── Tax Deadlines ─────────────────────────────────────────────────────────────
const existingDeadlines = sqlite.prepare("SELECT id FROM tax_deadlines LIMIT 1").get();

if (!existingDeadlines) {
  const insertDeadline = sqlite.prepare(`
    INSERT INTO tax_deadlines
      (entity_type, jurisdiction, form_name, description, recurrence,
       due_month, due_day, due_quarters, due_day_of_month, days_after_period_end, source_url)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // recurrence = 'annual'    → due_month + due_day
  // recurrence = 'quarterly' → due_quarters (JSON) + days_after_period_end
  // recurrence = 'monthly'   → due_day_of_month (of the following month)
  const deadlines = [
    // Federal — S-Corp
    [
      "scorp", "federal", "Form 1120-S",
      "S-Corporation annual income tax return. Reports company income, deductions, and distributes Schedule K-1 to each member.",
      "annual", 3, 15, null, null, 0,
      "https://www.irs.gov/forms-pubs/about-form-1120-s",
    ],
    [
      "all", "federal", "Form 1040",
      "Personal income tax return. S-Corp income passes through to members' personal returns via Schedule K-1.",
      "annual", 4, 15, null, null, 0,
      "https://www.irs.gov/forms-pubs/about-form-1040",
    ],
    [
      "all", "federal", "W-2s to Employees",
      "Deadline to furnish W-2 forms to all employees. Gusto files these automatically — confirm delivery in Gusto dashboard.",
      "annual", 1, 31, null, null, 0,
      "https://www.irs.gov/forms-pubs/about-form-w-2",
    ],
    // Federal — Employment (quarterly)
    // Q1 (Jan–Mar) → due Apr 30, Q2 → Jul 31, Q3 → Oct 31, Q4 → Jan 31
    [
      "all", "employment", "Form 941",
      "Employer's Quarterly Federal Tax Return. Reports wages paid, federal income tax withheld, and employee/employer FICA taxes.",
      "quarterly", null, null, "[1,2,3,4]", null, 30,
      "https://www.irs.gov/forms-pubs/about-form-941",
    ],
    // WA State
    [
      "scorp", "wa_state", "WA B&O Return",
      "Washington State Business & Occupation tax. Professional services rate: 1.5% of gross receipts. Due the 25th of the following month.",
      "monthly", null, null, null, 25, 0,
      "https://dor.wa.gov/taxes-rates/business-occupation-tax",
    ],
    [
      "all", "employment", "WA UI Tax Return",
      "Washington State Unemployment Insurance tax return. Filed quarterly with WA Employment Security Department.",
      "quarterly", null, null, "[1,2,3,4]", null, 30,
      "https://esd.wa.gov/employer-taxes",
    ],
    // Seattle
    [
      "scorp", "seattle", "Seattle B&O Return",
      "City of Seattle Business & Occupation tax. Rate: ~0.415% of gross receipts. Due the 25th of the following month.",
      "monthly", null, null, null, 25, 0,
      "https://seattle.gov/license-and-tax-administration/business-license-tax",
    ],
  ];

  for (const deadline of deadlines) {
    insertDeadline.run(...deadline);
  }
  console.log("✓ Seeded: 7 tax deadlines");
} else {
  console.log("Tax deadlines already exist — skipping");
}

console.log("\nSeed complete.");

// ── Add entity_type column to businesses (one-time migration) ─────────────────
// ALTER TABLE doesn't support IF NOT EXISTS in SQLite, so we check first
const businessColumns = sqlite
  .prepare("PRAGMA table_info(businesses)")
  .all() as { name: string }[];

const hasEntityType = businessColumns.some(col => col.name === "entity_type");

if (!hasEntityType) {
  sqlite.prepare(`
    ALTER TABLE businesses ADD COLUMN entity_type TEXT NOT NULL DEFAULT 'scorp'
  `).run();
  console.log("✓ Migration: added entity_type column to businesses");
} else {
  console.log("entity_type column already exists — skipping migration");
}

// Update Psyche Strategy to scorp (in case default didn't apply)
sqlite.prepare(`
  UPDATE businesses SET entity_type = 'scorp' WHERE id = 1
`).run();
console.log("✓ Psyche Strategy entity_type confirmed: scorp");

// ── Business Members ──────────────────────────────────────────────────────────
const existingMembers = sqlite.prepare("SELECT id FROM business_members LIMIT 1").get();

if (!existingMembers) {
  const insertMember = sqlite.prepare(`
    INSERT INTO business_members
      (business_id, name, ownership_pct, annual_salary, role)
    VALUES (?, ?, ?, ?, ?)
  `);

  const members = [
    [1, "Member A", 86.67, 75000, "officer"],
    [1, "Member B", 13.33,  3000, "officer"],
  ];

  for (const member of members) {
    insertMember.run(...member);
  }
  console.log("✓ Seeded: 2 business members (Psyche Strategy LLC)");
} else {
  console.log("Business members already exist — skipping");
}

// ── Compliance Obligations ────────────────────────────────────────────────────
const existingObligations = sqlite.prepare("SELECT id FROM compliance_obligations LIMIT 1").get();

if (!existingObligations) {
  const insertObligation = sqlite.prepare(`
    INSERT INTO compliance_obligations
      (business_id, name, category, jurisdiction, recurrence, due_month, due_day, source_url, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const obligations = [
    [
      1,
      "WA Secretary of State Annual Report",
      "Corporate",
      "WA State",
      "annual",
      1, 1,
      "https://ccfs.sos.wa.gov/",
      "Annual report to maintain LLC good standing. Due date varies — confirm exact date with SOS each year.",
    ],
    [
      1,
      "WA Business License Renewal",
      "License",
      "WA State",
      "annual",
      12, 31,
      "https://dor.wa.gov/open-business/apply-business-license",
      "Washington State Unified Business Identifier (UBI) license renewal.",
    ],
    [
      1,
      "Seattle Business License Renewal",
      "License",
      "Seattle",
      "annual",
      12, 31,
      "https://seattle.gov/license-and-tax-administration/business-license-tax",
      "City of Seattle business license renewal. Required to operate within city limits.",
    ],
    [
      1,
      "King County Business License",
      "License",
      "King County",
      "annual",
      12, 31,
      "https://kingcounty.gov/en/dept/dls/licenses-permits-and-codes/business-license",
      "King County business license renewal.",
    ],
  ];

  for (const obligation of obligations) {
    insertObligation.run(...obligation);
  }
  console.log("✓ Seeded: 4 compliance obligations");
} else {
  console.log("Compliance obligations already exist — skipping");
}

// ── Additional Compliance Obligations (idempotent) ────────────────────────────
{
  const insertIfMissing = (
    name: string, category: string, jurisdiction: string, recurrence: string,
    due_month: number, due_day: number, source_url: string, notes: string
  ) => {
    const exists = sqlite.prepare("SELECT id FROM compliance_obligations WHERE name = ? AND business_id = 1").get(name);
    if (!exists) {
      sqlite.prepare(`INSERT INTO compliance_obligations (business_id, name, category, jurisdiction, recurrence, due_month, due_day, source_url, notes) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`).run(name, category, jurisdiction, recurrence, due_month, due_day, source_url, notes);
      console.log("✓ Added obligation: " + name);
    }
  };

  insertIfMissing("Form 1120-S (S-Corp Tax Return)", "Tax Filing", "Federal", "annual", 3, 15, "https://www.irs.gov/forms-pubs/about-form-1120-s", "Annual S-Corp federal income tax return. Due March 15.");
  insertIfMissing("Form 941 (Quarterly Employment Tax)", "Tax Filing", "Federal", "annual", 4, 30, "https://www.irs.gov/forms-pubs/about-form-941", "Quarterly payroll tax filing. Q1 due April 30, Q2 July 31, Q3 October 31, Q4 January 31.");
  insertIfMissing("Form 940 (Annual FUTA)", "Tax Filing", "Federal", "annual", 1, 31, "https://www.irs.gov/forms-pubs/about-form-940", "Annual Federal Unemployment Tax Act filing. Due January 31.");
  insertIfMissing("WA B&O Tax Return", "Tax Filing", "WA State", "annual", 1, 25, "https://dor.wa.gov/taxes-rates/business-occupation-tax", "Washington State B&O tax. Professional services rate 1.5% of gross receipts. Filed monthly, due 25th of following month.");
  insertIfMissing("Seattle B&O Tax Return", "Tax Filing", "Seattle", "annual", 1, 25, "https://seattle.gov/license-and-tax-administration/business-license-tax", "City of Seattle B&O tax. Rate ~0.415% of gross receipts. Filed monthly, due 25th of following month.");
  insertIfMissing("WA Employment Security Department", "Employment", "WA State", "annual", 4, 30, "https://esd.wa.gov/employer-taxes", "WA unemployment insurance quarterly filing. Due last day of month following quarter end.");
}

// ── Default Settings ──────────────────────────────────────────────────────────
sqlite.prepare(`
  INSERT INTO settings (business_id, key, value)
  VALUES (?, 'ai_document_access', 'on')
  ON CONFLICT(business_id, key) DO NOTHING
`).run(1);
console.log("✓ Default settings ensured: ai_document_access");

// ── Cash Flow Settings ────────────────────────────────────────────────────────
sqlite.prepare(`
  INSERT INTO settings (business_id, key, value)
  VALUES (?, 'operating_reserve', '5000')
  ON CONFLICT(business_id, key) DO NOTHING
`).run(1);

sqlite.prepare(`
  INSERT INTO settings (business_id, key, value)
  VALUES (?, 'current_cash_manual', '0')
  ON CONFLICT(business_id, key) DO NOTHING
`).run(1);

console.log("✓ Default settings ensured: operating_reserve, current_cash_manual");