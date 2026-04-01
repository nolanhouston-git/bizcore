"use client";

import { useState, useTransition } from "react";
import { formatDate } from "@/lib/dateFormat";
import {
  recordManualDistribution,
  deleteDistribution,
  updateDistributionDescription,
  updateOperatingReserve,
} from "./actions";

interface MemberSplit {
  name: string;
  ownership_pct: number;
  amount: number;
}

interface Distribution {
  id: number;
  date: string;
  description: string;
  amount: number;
  source: string;
  created_at: string;
}

interface Props {
  currentCash: number;
  cachedAt: string;
  operatingReserve: number;
  projected60Day: number;
  avgMonthlyExpenses: number;
  nextTaxPayment: number;
  loanRepaymentsNext60Days: number;
  safeDistribution: number;
  indicator: "green" | "amber" | "red";
  memberSplits: MemberSplit[];
  distributions: Distribution[];
  dateFormat: string;
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const INDICATOR_STYLES = {
  green: {
    border: "border-green-500",
    bg:     "bg-green-500/10",
    text:   "text-green-400",
    badge:  "bg-green-500/20 text-green-300",
    label:  "Safe to Distribute",
  },
  amber: {
    border: "border-yellow-500",
    bg:     "bg-yellow-500/10",
    text:   "text-yellow-400",
    badge:  "bg-yellow-500/20 text-yellow-300",
    label:  "Distribute with Caution",
  },
  red: {
    border: "border-red-500",
    bg:     "bg-red-500/10",
    text:   "text-red-400",
    badge:  "bg-red-500/20 text-red-300",
    label:  "Do Not Distribute",
  },
};

export default function CashflowClient({
  currentCash, cachedAt, operatingReserve, projected60Day,
  avgMonthlyExpenses, nextTaxPayment, loanRepaymentsNext60Days, safeDistribution,
  indicator, memberSplits, distributions, dateFormat,
}: Props) {
  const style = INDICATOR_STYLES[indicator];

  // ── Refresh balance ───────────────────────────────────────────────────────
  const [refreshing, setRefreshing]   = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch("/api/plaid/balance");
      if (!res.ok) throw new Error("Failed");
      window.location.reload();
    } catch {
      setRefreshError("Could not reach Plaid. Try again.");
      setRefreshing(false);
    }
  }

  // ── Operating reserve inline edit ─────────────────────────────────────────
  const [editingReserve, setEditingReserve] = useState(false);
  const [reserveInput, setReserveInput]     = useState(operatingReserve.toString());
  const [reservePending, startReserveTransition] = useTransition();

  function handleReserveSave() {
    const fd = new FormData();
    fd.append("operating_reserve", reserveInput);
    startReserveTransition(async () => {
      await updateOperatingReserve(fd);
      setEditingReserve(false);
    });
  }

  // ── Manual distribution form ──────────────────────────────────────────────
  const [showForm, setShowForm]         = useState(false);
  const [formError, setFormError]       = useState<string | null>(null);
  const [formPending, startFormTransition] = useTransition();

  function handleRecord(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    startFormTransition(async () => {
      const result = await recordManualDistribution(fd);
      if (result.error) {
        setFormError(result.error);
      } else {
        setShowForm(false);
        (e.target as HTMLFormElement).reset();
      }
    });
  }

  // ── Inline description edit ───────────────────────────────────────────────
  const [editingId, setEditingId]       = useState<number | null>(null);
  const [editingDesc, setEditingDesc]   = useState("");
  const [editPending, startEditTransition] = useTransition();

  function startEdit(d: Distribution) {
    setEditingId(d.id);
    setEditingDesc(d.description);
  }

  function handleEditSave(id: number) {
    startEditTransition(async () => {
      await updateDistributionDescription(id, editingDesc);
      setEditingId(null);
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const [confirmId, setConfirmId]       = useState<number | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  function handleDelete(id: number) {
    startDeleteTransition(async () => {
      await deleteDistribution(id);
      setConfirmId(null);
    });
  }

  const cachedAtDisplay = cachedAt
    ? new Date(cachedAt).toLocaleString("en-US", {
        month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit",
      })
    : "Never";

  // Total distributed (for history summary)
  const totalDistributed = distributions.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Cash Flow & Distributions</h1>
        <p className="text-sm text-slate-400 mt-1">
          Safe distribution calculator and history for Psyche Strategy LLC
        </p>
      </div>

      {/* ── Safe Distribution Calculator ── */}
      <div className={`rounded-xl border-2 ${style.border} ${style.bg} p-6 space-y-6`}>

        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${style.badge}`}>
              ● {style.label}
            </span>
            <div className={`text-4xl font-bold mt-2 ${style.text}`}>
              {fmt(Math.max(0, safeDistribution))}
            </div>
            <div className="text-xs text-slate-400 mt-1">safe to distribute</div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-500">Balance last refreshed</div>
            <div className="text-sm text-slate-300">{cachedAtDisplay}</div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "↻ Refresh Balance"}
            </button>
            {refreshError && (
              <div className="text-xs text-red-400 mt-1">{refreshError}</div>
            )}
          </div>
        </div>

        {/* Breakdown */}
        <div className="border-t border-slate-700 pt-4 space-y-2">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
            How this is calculated
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-300">Current Cash (Plaid)</span>
            <span className="text-white font-medium">{fmt(currentCash)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">− Next Tax Payment</span>
            <span className="text-slate-400">
              {fmt(nextTaxPayment)}
              <span className="text-xs text-slate-500 ml-1">(placeholder)</span>
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">− Loan Repayments (60 day)</span>
            <span className="text-slate-400">{fmt(loanRepaymentsNext60Days)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">
              − Projected 60-day Expenses
              <span className="text-xs text-slate-500 ml-1">
                ({fmt(avgMonthlyExpenses)}/mo avg)
              </span>
            </span>
            <span className="text-slate-400">{fmt(projected60Day)}</span>
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-slate-400">− Operating Reserve</span>
            <div className="flex items-center gap-2">
              {editingReserve ? (
                <>
                  <input
                    type="number"
                    value={reserveInput}
                    onChange={e => setReserveInput(e.target.value)}
                    className="w-28 px-2 py-0.5 text-sm rounded bg-slate-800 border border-slate-600 text-white text-right"
                  />
                  <button
                    onClick={handleReserveSave}
                    disabled={reservePending}
                    className="text-xs text-green-400 hover:text-green-300"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingReserve(false)}
                    className="text-xs text-slate-500 hover:text-slate-400"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="text-slate-400">{fmt(operatingReserve)}</span>
                  <button
                    onClick={() => setEditingReserve(true)}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    Edit
                  </button>
                </>
              )}
            </div>
          </div>
          <div className={`flex justify-between text-sm font-semibold pt-2 border-t border-slate-700 ${style.text}`}>
            <span>= Safe Distribution</span>
            <span>{fmt(Math.max(0, safeDistribution))}</span>
          </div>
        </div>

        {/* Per-member split — rows */}
        {safeDistribution > 0 && (
          <div className="border-t border-slate-700 pt-4 space-y-2">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
              Per-Member Split
            </div>
            {memberSplits.map(m => (
              <div key={m.name} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3">
                <div>
                  <div className="text-sm text-slate-300">{m.name}</div>
                  <div className="text-xs text-slate-500">{m.ownership_pct}% ownership</div>
                </div>
                <div className="text-lg font-semibold text-white">{fmt(m.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Distribution History ── */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Distribution History</h2>
            {distributions.length > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">
                {distributions.length} transaction{distributions.length !== 1 ? "s" : ""} · {fmt(totalDistributed)} total
              </p>
            )}
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          >
            {showForm ? "Cancel" : "+ Manual Entry"}
          </button>
        </div>

        {/* Manual entry form — collapsed by default */}
        {showForm && (
          <form onSubmit={handleRecord} className="mb-6 p-4 bg-slate-800/50 rounded-lg space-y-3 border border-slate-700">
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">
              Record Manual Distribution
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Date</label>
                <input
                  type="date"
                  name="distribution_date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Amount</label>
                <input
                  type="number"
                  name="total_amount"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Description</label>
              <input
                type="text"
                name="description"
                placeholder="e.g. Q1 Member Distribution"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm"
              />
            </div>
            {formError && <div className="text-sm text-red-400">{formError}</div>}
            <button
              type="submit"
              disabled={formPending}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {formPending ? "Recording…" : "Record Distribution"}
            </button>
          </form>
        )}

        {/* History table */}
        {distributions.length === 0 ? (
          <p className="text-sm text-slate-500">
            No distributions recorded yet. Categorize a bank transaction as{" "}
            <span className="text-slate-300 font-medium">Distributions</span> on the Expenses page,
            or use Manual Entry above.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Source</th>
                <th className="pb-2 font-medium">Per Member</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {distributions.map(d => {
                const splits = memberSplits.map(m => ({
                  name:   m.name,
                  amount: d.amount * (m.ownership_pct / 100),
                }));
                return (
                  <tr key={d.id} className="text-slate-300 align-top">
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {formatDate(d.date, dateFormat)}
                    </td>
                    <td className="py-3 pr-4">
                      {editingId === d.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={editingDesc}
                            onChange={e => setEditingDesc(e.target.value)}
                            className="px-2 py-0.5 text-sm rounded bg-slate-800 border border-slate-600 text-white flex-1"
                          />
                          <button
                            onClick={() => handleEditSave(d.id)}
                            disabled={editPending}
                            className="text-xs text-green-400 hover:text-green-300"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs text-slate-500 hover:text-slate-400"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span
                          className="cursor-pointer hover:text-white transition-colors"
                          onClick={() => startEdit(d)}
                          title="Click to edit"
                        >
                          {d.description}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-medium text-white whitespace-nowrap">
                      {fmt(d.amount)}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        d.source === "bank"
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-slate-700 text-slate-400"
                      }`}>
                        {d.source === "bank" ? "Plaid" : "Manual"}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="space-y-0.5">
                        {splits.map(s => (
                          <div key={s.name} className="text-xs text-slate-400">
                            {s.name}: {fmt(s.amount)}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      {confirmId === d.id ? (
                        <span className="flex items-center justify-end gap-2">
                          <span className="text-xs text-slate-400">Delete?</span>
                          <button
                            onClick={() => handleDelete(d.id)}
                            disabled={deletePending}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="text-xs text-slate-500 hover:text-slate-400"
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmId(d.id)}
                          className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}