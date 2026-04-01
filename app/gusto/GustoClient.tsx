"use client";

import React, { useState, useEffect } from "react";
import { formatDate, formatDateTime } from "@/lib/dateFormat";
import { connectGusto, disconnectGusto, syncGusto } from "./actions";

const C = {
  bg: "#080b12", surface: "#0f1420", surfaceB: "#141926", border: "#1e2535",
  borderHi: "#2a3550", accent: "#4f8ef7", accentDim: "#1e3a6e",
  gold: "#e8b84b", goldDim: "#3d2f0a", green: "#34d399", greenDim: "#052e1a",
  red: "#f87171", redDim: "#2d0a0a", purple: "#a78bfa", pink: "#f472b6",
  pinkDim: "#3b0a2a", textPri: "#e8edf5", textSec: "#8896b0", textDim: "#4a566e",
  mono: "'Fira Code','Cascadia Code',monospace", sans: "'Outfit','DM Sans',sans-serif",
};

const PAYROLL_COLORS = {
  gross:       C.pink,
  employeeTax: C.gold,
  employerTax: C.purple,
  netEmployee: C.green,
  totalCost:   C.accent,
};

type Employee = { name: string; gross_pay: number; employee_taxes: number; employer_taxes: number; net_pay: number; };
type Run = { gusto_run_id: string; pay_period_start: string; pay_period_end: string; pay_date: string; employees: Employee[]; };
type GustoConnection = { connected: number; last_synced: string | null; } | null;

function Tag({ label, color = C.accent }: { label: string; color?: string }) {
  return (
    <span style={{ background: color + "18", color, border: `1px solid ${color}44`, borderRadius: 6,
      padding: "2px 10px", fontSize: 11, fontFamily: C.mono, textTransform: "uppercase" as const,
      letterSpacing: 0.8, whiteSpace: "nowrap" as const }}>{label}</span>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: 1, background: C.surface, border: `1px solid ${color}44`,
      borderRadius: 12, padding: "16px 20px", boxShadow: `0 0 24px ${color}10` }}>
      <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase" as const,
        letterSpacing: 1, fontFamily: C.mono, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontFamily: C.mono, color, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function fmt(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtMonth(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleString("en-US", { month: "long", year: "numeric" });
}
// kept for month labels only — all other dates use formatDate()

type MonthGroup = {
  monthKey: string;   // "2026-03"
  monthLabel: string; // "March 2026"
  runs: Run[];
};

// Group flat rows into runs for display
function groupIntoRuns(rows: any[]): Run[] {
  const map = new Map<string, Run>();
  for (const row of rows) {
    if (!map.has(row.gusto_run_id)) {
      map.set(row.gusto_run_id, {
        gusto_run_id: row.gusto_run_id,
        pay_period_start: row.pay_period_start,
        pay_period_end: row.pay_period_end,
        pay_date: row.pay_date,
        employees: [],
      });
    }
    map.get(row.gusto_run_id)!.employees.push({
      name: row.employee_name,
      gross_pay: row.gross_pay,
      employee_taxes: row.employee_taxes,
      employer_taxes: row.employer_taxes,
      net_pay: row.net_pay,
    });
  }
  return Array.from(map.values()).sort((a, b) => b.pay_date.localeCompare(a.pay_date));
}

// Group runs into calendar months
function groupIntoMonths(runs: Run[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>();
  for (const run of runs) {
    const monthKey = run.pay_period_start.slice(0, 7); // "2026-03"
    if (!map.has(monthKey)) {
      const monthLabel = new Date(monthKey + "-01T12:00:00").toLocaleString("en-US", { month: "long", year: "numeric" });
      map.set(monthKey, { monthKey, monthLabel, runs: [] });
    }
    map.get(monthKey)!.runs.push(run);
  }
  return Array.from(map.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

const RANGE_OPTIONS = [
  { label: "YTD",      value: "ytd" },
  { label: "Prior Year", value: "prior" },
  { label: "Last 3",   value: 3 },
  { label: "Last 6",   value: 6 },
  { label: "Last 12",  value: 12 },
  { label: "All",      value: 999 },
];

export default function GustoClient({
  connection, rows, dateFormat,
}: {
  connection: GustoConnection;
  rows: any[];
  dateFormat: string;
}) {
  const connected = connection?.connected === 1;
  const [loading, setLoading] = useState<string | null>(null);
  const [range, setRange] = useState<number | string>("ytd");
  // Months expanded by default, runs collapsed
  const [lastSyncedStr, setLastSyncedStr] = useState("");
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set(["ALL_MONTHS"]));
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (connection?.last_synced) {
      setLastSyncedStr(formatDateTime(connection.last_synced, dateFormat));
    }
  }, [connection?.last_synced, dateFormat]);

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(monthKey)) { next.delete(monthKey); } else { next.add(monthKey); }
      return next;
    });
  };

  const isMonthExpanded = (monthKey: string) =>
    expandedMonths.has("ALL_MONTHS") || expandedMonths.has(monthKey);

  const toggleRun = (runId: string) => {
    setExpandedRuns(prev => {
      const next = new Set(prev);
      if (next.has(runId)) { next.delete(runId); } else { next.add(runId); }
      return next;
    });
  };

  const allRuns = groupIntoRuns(rows);

  const currentYear = new Date().getFullYear();
  const priorYear = currentYear - 1;

  // Filter rows by selected range
  const filteredRows = (() => {
    if (range === "ytd") {
      return rows.filter(r => r.pay_period_start.startsWith(String(currentYear)));
    }
    if (range === "prior") {
      return rows.filter(r => r.pay_period_start.startsWith(String(priorYear)));
    }
    // numeric = last N runs by pay date
    const runIds = allRuns.slice(0, range as number).map(r => r.gusto_run_id);
    return rows.filter(r => runIds.includes(r.gusto_run_id));
  })();

  const filteredRuns = (() => {
    if (range === "ytd") return allRuns.filter(r => r.pay_period_start.startsWith(String(currentYear)));
    if (range === "prior") return allRuns.filter(r => r.pay_period_start.startsWith(String(priorYear)));
    return allRuns.slice(0, range as number);
  })();

  const monthGroups = groupIntoMonths(filteredRuns);

  // Seed expandedMonths with all month keys on first render so months start expanded


  const RANGE_LABELS: Record<string, string> = {
    ytd:   `YTD ${currentYear}`,
    prior: `${priorYear}`,
    3:     "Last 3 Runs",
    6:     "Last 6 Runs",
    12:    "Last 12 Runs",
    999:   "All Time",
  };
  const rangeLabel = RANGE_LABELS[String(range)] ?? "";

  const ytdGross   = filteredRows.reduce((s, r) => s + r.gross_pay, 0);
  const ytdEmpTax  = filteredRows.reduce((s, r) => s + r.employee_taxes, 0);
  const ytdEmprTax = filteredRows.reduce((s, r) => s + r.employer_taxes, 0);
  const ytdNet     = filteredRows.reduce((s, r) => s + r.net_pay, 0);

  const handle = async (action: () => Promise<any>, label: string) => {
    setLoading(label);
    await action();
    setLoading(null);
  };

  const btnBase = {
    border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13,
    fontWeight: 700, cursor: "pointer", fontFamily: C.sans,
  } as const;

  return (
    <div style={{ fontFamily: C.sans, color: C.textPri }}>

      {/* Connection card */}
      <div style={{ background: C.surface, border: `1px solid ${connected ? C.pink + "44" : C.border}`,
        borderRadius: 14, padding: 24, marginBottom: 24,
        boxShadow: connected ? `0 0 32px ${C.pink}12` : "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%",
                background: connected ? C.pink : C.textDim,
                boxShadow: connected ? `0 0 8px ${C.pink}` : "none" }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: C.textPri }}>
                {loading === "connect" ? "Connecting to Gusto…" : connected ? "Gusto Connected" : "Gusto Not Connected"}
              </span>
              {connected && <Tag label="Live" color={C.pink} />}
            </div>
            {connected && connection?.last_synced && (
              <div style={{ fontSize: 11, color: C.textDim, fontFamily: C.mono }}>
                Last synced: {lastSyncedStr}
              </div>
            )}
            {!connected && (
              <div style={{ fontSize: 12, color: C.textSec, marginTop: 4, maxWidth: 440, lineHeight: 1.6 }}>
                Connect Gusto to automatically import payroll runs, populate W-2 wages in the Tax Advisor, and create approved payroll expense entries.
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            {!connected && (
              <button onClick={() => handle(connectGusto, "connect")} disabled={loading !== null}
                style={{ ...btnBase, background: `linear-gradient(135deg,${C.pink},#db2777)`, color: "#fff", opacity: loading ? 0.6 : 1 }}>
                {loading === "connect" ? "Connecting…" : "◎ Connect Gusto"}
              </button>
            )}
            {connected && (<>
              <button onClick={() => handle(syncGusto, "sync")} disabled={loading !== null}
                style={{ ...btnBase, background: C.pinkDim, border: `1px solid ${C.pink}`, color: C.pink, opacity: loading ? 0.6 : 1 }}>
                {loading === "sync" ? "Syncing…" : "↻ Sync Now"}
              </button>
              <button onClick={() => handle(disconnectGusto, "disconnect")} disabled={loading !== null}
                style={{ ...btnBase, background: C.redDim, border: `1px solid ${C.red}44`, color: C.red, opacity: loading ? 0.6 : 1 }}>
                Disconnect
              </button>
            </>)}
          </div>
        </div>

        {/* Feature tags when disconnected */}
        {!connected && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
            {["Auto-import payroll runs", "W-2 wages → Tax Advisor", "Approved expense entries", "YTD summary", "Per-employee breakdown"].map(t => (
              <Tag key={t} label={t} color={C.pink} />
            ))}
          </div>
        )}
      </div>

      {/* YTD summary — only when connected and synced */}
      {connected && rows.length > 0 && (<>
        {/* Range selector — above stat cards */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 11, color: C.textDim, fontFamily: C.mono, letterSpacing: 1, textTransform: "uppercase", marginRight: 4 }}>
            Period
          </span>
          {RANGE_OPTIONS.map(opt => (
            <button key={String(opt.value)} onClick={() => setRange(opt.value)}
              style={{ background: range === opt.value ? C.pinkDim : "transparent",
                border: `1px solid ${range === opt.value ? C.pink : C.border}`,
                borderRadius: 8, padding: "5px 14px", color: range === opt.value ? C.pink : C.textDim,
                fontSize: 12, cursor: "pointer", fontFamily: C.mono, fontWeight: range === opt.value ? 600 : 400 }}>
              {opt.label}
            </button>
          ))}
          <div style={{ marginLeft: 8, paddingLeft: 12, borderLeft: `2px solid ${C.pink}44` }}>
            <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>Showing</div>
            <div style={{ fontSize: 14, color: C.pink, fontFamily: C.mono, fontWeight: 700 }}>{rangeLabel}</div>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
          <StatCard label="Gross Payroll"      value={fmt(ytdGross)}              color={PAYROLL_COLORS.gross} />
          <StatCard label="Employee Taxes"     value={fmt(ytdEmpTax)}             color={PAYROLL_COLORS.employeeTax} />
          <StatCard label="Employer Taxes"     value={fmt(ytdEmprTax)}            color={PAYROLL_COLORS.employerTax} />
          <StatCard label="Net to Employees"   value={fmt(ytdNet)}                color={PAYROLL_COLORS.netEmployee} />
          <StatCard label="Total Business Cost" value={fmt(ytdGross + ytdEmprTax)} color={PAYROLL_COLORS.totalCost} />
        </div>

        {/* Payroll run cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredRuns.map(run => {
            const runGross  = run.employees.reduce((s, e) => s + e.gross_pay, 0);
            const runEmpTax = run.employees.reduce((s, e) => s + e.employee_taxes, 0);
            const runEmpr   = run.employees.reduce((s, e) => s + e.employer_taxes, 0);
            const runNet    = run.employees.reduce((s, e) => s + e.net_pay, 0);
            return (
              <div key={run.gusto_run_id} style={{ background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 12, overflow: "hidden" }}>
                {/* Run header */}
                <div onClick={() => toggleRun(run.gusto_run_id)}
                  style={{ padding: "14px 20px", borderBottom: expandedRuns.has(run.gusto_run_id) ? `1px solid ${C.border}` : "none",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  cursor: "pointer", userSelect: "none" as const }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, transition: "transform 0.15s",
                      display: "inline-block", transform: expandedRuns.has(run.gusto_run_id) ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.textPri }}>
                        {fmtMonth(run.pay_period_start)}
                      </div>
                      <div style={{ fontSize: 11, color: C.textDim, fontFamily: C.mono, marginTop: 2 }}>
                        {run.pay_period_start} → {run.pay_period_end} · Pay date: {run.pay_date}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 20, textAlign: "right" as const }}>
                    {[
                      { label: "Gross",              value: fmt(runGross),             color: PAYROLL_COLORS.gross },
                      { label: "Employee Tax",        value: fmt(runEmpTax),            color: PAYROLL_COLORS.employeeTax },
                      { label: "Employer Tax",        value: fmt(runEmpr),              color: PAYROLL_COLORS.employerTax },
                      { label: "Net to Employees",    value: fmt(runNet),               color: PAYROLL_COLORS.netEmployee },
                      { label: "Total Business Cost", value: fmt(runGross + runEmpr),   color: PAYROLL_COLORS.totalCost },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
                        <div style={{ fontSize: 14, fontFamily: C.mono, color, fontWeight: 700 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Per-employee rows — only shown when expanded */}
                {expandedRuns.has(run.gusto_run_id) && <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {["Employee", "Gross Pay", "Employee FICA", "Employer Tax", "Net Pay", "Total Cost"].map(h => (
                        <th key={h} style={{ padding: "8px 20px", textAlign: "left", fontSize: 10,
                          color: C.textDim, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", fontFamily: C.mono }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {run.employees.map(emp => (
                      <tr key={emp.name} style={{ borderBottom: `1px solid ${C.border}22` }}>
                        <td style={{ padding: "10px 20px", fontSize: 13, color: C.textPri, fontWeight: 500 }}>{emp.name}</td>
                        <td style={{ padding: "10px 20px", fontSize: 13, fontFamily: C.mono, color: PAYROLL_COLORS.gross }}>{fmt(emp.gross_pay)}</td>
                        <td style={{ padding: "10px 20px", fontSize: 13, fontFamily: C.mono, color: PAYROLL_COLORS.employeeTax }}>{fmt(emp.employee_taxes)}</td>
                        <td style={{ padding: "10px 20px", fontSize: 13, fontFamily: C.mono, color: PAYROLL_COLORS.employerTax }}>{fmt(emp.employer_taxes)}</td>
                        <td style={{ padding: "10px 20px", fontSize: 13, fontFamily: C.mono, color: PAYROLL_COLORS.netEmployee }}>{fmt(emp.net_pay)}</td>
                        <td style={{ padding: "10px 20px", fontSize: 13, fontFamily: C.mono, color: PAYROLL_COLORS.totalCost, fontWeight: 700 }}>{fmt(emp.gross_pay + emp.employer_taxes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>}
              </div>
            );
          })}
        </div>
      </>)}

      {/* Connected but not yet synced */}
      {connected && rows.length === 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: 40, textAlign: "center" as const }}>
          <div style={{ fontSize: 13, color: C.textDim, fontFamily: C.mono, marginBottom: 16 }}>
            Connected — click Sync Now to import payroll data
          </div>
          <button onClick={() => handle(syncGusto, "sync")} disabled={loading !== null}
            style={{ ...btnBase, background: `linear-gradient(135deg,${C.pink},#db2777)`, color: "#fff" }}>
            ↻ Sync Now
          </button>
        </div>
      )}
    </div>
  );
}
