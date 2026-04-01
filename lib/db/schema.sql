CREATE TABLE IF NOT EXISTS businesses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  dba         TEXT,
  industry    TEXT,
  structure   TEXT,
  city        TEXT,
  state       TEXT,
  county      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id   INTEGER NOT NULL DEFAULT 1,
  date          TEXT NOT NULL,
  description   TEXT NOT NULL,
  merchant_name TEXT,
  amount        REAL NOT NULL,
  category      TEXT NOT NULL DEFAULT 'Other',
  status        TEXT NOT NULL DEFAULT 'pending',
  source        TEXT NOT NULL DEFAULT 'manual',
  plaid_transaction_id TEXT,
  deleted_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

CREATE TABLE IF NOT EXISTS income (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id   INTEGER NOT NULL DEFAULT 1,
  date          TEXT NOT NULL,
  description   TEXT NOT NULL,
  merchant_name TEXT,
  amount        REAL NOT NULL,
  category      TEXT NOT NULL DEFAULT 'Other Income',
  status        TEXT NOT NULL DEFAULT 'pending',
  source        TEXT NOT NULL DEFAULT 'manual',
  plaid_transaction_id TEXT,
  deleted_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

CREATE TABLE IF NOT EXISTS plaid_connections (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id      INTEGER NOT NULL DEFAULT 1,
  access_token     TEXT NOT NULL,
  item_id          TEXT NOT NULL,
  institution_name TEXT,
  institution_id   TEXT,
  cursor           TEXT,
  connected_at     TEXT NOT NULL DEFAULT (datetime('now')),
  last_synced      TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

CREATE TABLE IF NOT EXISTS tax_rules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  rule_key    TEXT NOT NULL,
  rule_value  TEXT NOT NULL,
  tax_year    INTEGER NOT NULL,
  label       TEXT,
  description TEXT,
  source_url  TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(entity_type, rule_key, tax_year)
);

CREATE TABLE IF NOT EXISTS tax_brackets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  filing_type TEXT NOT NULL,
  tax_year    INTEGER NOT NULL,
  bracket_min REAL NOT NULL,
  bracket_max REAL,
  rate        REAL NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tax_deadlines (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type           TEXT NOT NULL,
  jurisdiction          TEXT NOT NULL,
  form_name             TEXT NOT NULL,
  description           TEXT,
  recurrence            TEXT NOT NULL,
  due_month             INTEGER,
  due_day               INTEGER,
  due_quarters          TEXT,
  due_day_of_month      INTEGER,
  days_after_period_end INTEGER NOT NULL DEFAULT 0,
  source_url            TEXT,
  active                INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tax_deadline_completions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id  INTEGER NOT NULL DEFAULT 1,
  deadline_id  INTEGER NOT NULL REFERENCES tax_deadlines(id),
  tax_year     INTEGER NOT NULL,
  period       TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(business_id, deadline_id, tax_year, period),
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

CREATE TABLE IF NOT EXISTS business_members (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id   INTEGER NOT NULL DEFAULT 1,
  name          TEXT NOT NULL,
  ownership_pct REAL NOT NULL,
  annual_salary REAL NOT NULL DEFAULT 0,
  role          TEXT NOT NULL DEFAULT 'owner',
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);
-- Gusto connection state (one row per business)
CREATE TABLE IF NOT EXISTS gusto_connections (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id   INTEGER NOT NULL UNIQUE,
  connected     INTEGER NOT NULL DEFAULT 0,
  last_synced   TEXT,
  synced_at     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Gusto payroll runs (one row per employee per run)
CREATE TABLE IF NOT EXISTS gusto_payroll_runs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id       INTEGER NOT NULL,
  gusto_run_id      TEXT NOT NULL,
  sync_batch_id     TEXT NOT NULL,
  pay_period_start  TEXT NOT NULL,
  pay_period_end    TEXT NOT NULL,
  pay_date          TEXT NOT NULL,
  employee_name     TEXT NOT NULL,
  gross_pay         REAL NOT NULL DEFAULT 0,
  employee_taxes    REAL NOT NULL DEFAULT 0,
  employer_taxes    REAL NOT NULL DEFAULT 0,
  net_pay           REAL NOT NULL DEFAULT 0,
  synced_at         TEXT NOT NULL DEFAULT (datetime('now')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- App-wide settings (key-value)
CREATE TABLE IF NOT EXISTS settings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(business_id, key)
);

-- Compliance obligations (master register)
CREATE TABLE IF NOT EXISTS compliance_obligations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id  INTEGER NOT NULL DEFAULT 1,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  recurrence   TEXT NOT NULL DEFAULT 'annual',
  due_month    INTEGER,
  due_day      INTEGER,
  source_url   TEXT,
  notes        TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

-- Compliance completions (history of mark-complete actions)
CREATE TABLE IF NOT EXISTS compliance_completions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id   INTEGER NOT NULL DEFAULT 1,
  obligation_id INTEGER NOT NULL REFERENCES compliance_obligations(id),
  period_label  TEXT NOT NULL,
  notes         TEXT,
  completed_at  TEXT NOT NULL DEFAULT (datetime('now')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(business_id, obligation_id, period_label),
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

-- Document storage (metadata for files stored in Cloudflare R2)
CREATE TABLE IF NOT EXISTS documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL DEFAULT 1,
  r2_key      TEXT NOT NULL UNIQUE,
  file_name   TEXT NOT NULL,
  file_size   INTEGER NOT NULL,
  mime_type   TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'Other',
  linked_to   TEXT,
  linked_id   INTEGER,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

-- Distribution history log
CREATE TABLE IF NOT EXISTS distributions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id       INTEGER NOT NULL DEFAULT 1,
  distribution_date TEXT NOT NULL,
  total_amount      REAL NOT NULL,
  member_a_amount   REAL NOT NULL,
  member_b_amount   REAL NOT NULL,
  notes             TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at        TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

-- loan_parties: central registry for external lenders/borrowers
CREATE TABLE IF NOT EXISTS loan_parties (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id  INTEGER NOT NULL DEFAULT 1,
  name         TEXT NOT NULL,
  party_type   TEXT NOT NULL CHECK(party_type IN ('bank','individual','government','other')),
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- loans: the loan register
CREATE TABLE IF NOT EXISTS loans (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id           INTEGER NOT NULL DEFAULT 1,
  lender_type           TEXT NOT NULL CHECK(lender_type IN ('member','business','external')),
  lender_id             INTEGER NOT NULL,
  borrower_type         TEXT NOT NULL CHECK(borrower_type IN ('member','business','external')),
  borrower_id           INTEGER NOT NULL,
  original_amount       REAL NOT NULL,
  interest_rate         REAL NOT NULL,
  compounding_frequency TEXT NOT NULL DEFAULT 'simple'
                        CHECK(compounding_frequency IN ('annual','semiannual','quarterly','monthly','daily','continuous','simple')),
  term_months           INTEGER,
  start_date            TEXT NOT NULL,
  payment_amount        REAL,
  notes                 TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at            TEXT
);

-- loan_payments: every transaction against a loan
CREATE TABLE IF NOT EXISTS loan_payments (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id      INTEGER NOT NULL DEFAULT 1,
  loan_id          INTEGER NOT NULL REFERENCES loans(id),
  payment_date     TEXT NOT NULL,
  payment_type     TEXT NOT NULL CHECK(payment_type IN ('payment','advance','capitalized_interest')),
  principal_amount REAL NOT NULL DEFAULT 0,
  interest_amount  REAL NOT NULL DEFAULT 0,
  days_covered     INTEGER,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at       TEXT
);

-- Loan amendment audit trail (all changes to loan fields are logged here)
CREATE TABLE IF NOT EXISTS loan_amendments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id   INTEGER NOT NULL DEFAULT 1,
  loan_id       INTEGER NOT NULL REFERENCES loans(id),
  field_changed TEXT NOT NULL,
  old_value     TEXT NOT NULL,
  new_value     TEXT NOT NULL,
  reason        TEXT NOT NULL,
  amended_at    TEXT NOT NULL DEFAULT (datetime('now'))
);