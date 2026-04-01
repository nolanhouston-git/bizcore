-- Session 12a amendment: loan_amendments audit trail table
-- Run once against the live database

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
