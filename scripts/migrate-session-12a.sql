-- Session 12a migration: Loans & Member Advances
-- Run once against the live database
-- Safe to run: CREATE TABLE IF NOT EXISTS will skip existing tables

CREATE TABLE IF NOT EXISTS loan_parties (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id  INTEGER NOT NULL DEFAULT 1,
  name         TEXT NOT NULL,
  party_type   TEXT NOT NULL CHECK(party_type IN ('bank','individual','government','other')),
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

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

-- Add loan linkage to existing ledger tables
ALTER TABLE expenses ADD COLUMN linked_loan_id INTEGER REFERENCES loans(id);
ALTER TABLE income ADD COLUMN linked_loan_id INTEGER REFERENCES loans(id);

-- Seed default setting for loan transaction visibility
INSERT OR IGNORE INTO settings (business_id, key, value)
VALUES (1, 'show_loan_transactions', 'off');
