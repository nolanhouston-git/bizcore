"use client";
import React from "react";
import { C, fmt, fmtShort, WidgetShell, StatLabel, StatValue, Tag } from "./shared";
import type { DashboardData } from "@/lib/dashboardData";

type Props = { data: DashboardData; editMode?: boolean; };

export function YTDRevenueWidget({ data, editMode }: Props) {
  return (
    <WidgetShell editMode={editMode} label="YTD Revenue">
      <div style={{ height: "100%", overflowY: "auto" }}>
        <StatLabel>YTD Revenue</StatLabel>
        <StatValue color={C.green}>{fmt(data.ytdRevenue)}</StatValue>
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 8, fontFamily: C.mono }}>
          {new Date().getFullYear()} approved income
        </div>
      </div>
    </WidgetShell>
  );
}

export function YTDExpensesWidget({ data, editMode }: Props) {
  return (
    <WidgetShell editMode={editMode} label="YTD Expenses">
      <div style={{ height: "100%", overflowY: "auto" }}>
        <StatLabel>YTD Expenses</StatLabel>
        <StatValue color={C.accent}>{fmt(data.ytdExpenses)}</StatValue>
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 8, fontFamily: C.mono }}>
          {new Date().getFullYear()} approved expenses
        </div>
      </div>
    </WidgetShell>
  );
}

export function NetIncomeWidget({ data, editMode }: Props) {
  const positive = data.netIncome >= 0;
  return (
    <WidgetShell editMode={editMode} label="Net Income">
      <div style={{ height: "100%", overflowY: "auto" }}>
        <StatLabel>Net Income</StatLabel>
        <StatValue color={positive ? C.green : C.red}>{fmt(data.netIncome)}</StatValue>
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 8, fontFamily: C.mono }}>
          Revenue minus expenses
        </div>
      </div>
    </WidgetShell>
  );
}

export function PendingReviewWidget({ data, editMode }: Props) {
  const total = data.pendingExpenses + data.pendingIncome;
  return (
    <WidgetShell editMode={editMode} label="Pending Review">
      <div style={{ height: "100%", overflowY: "auto" }}>
        <StatLabel>Pending Review</StatLabel>
        <StatValue color={total > 0 ? C.gold : C.green}>{total}</StatValue>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" as const }}>
          {data.pendingExpenses > 0 && <Tag label={`${data.pendingExpenses} expenses`} color={C.gold} />}
          {data.pendingIncome > 0   && <Tag label={`${data.pendingIncome} income`}    color={C.purple} />}
          {total === 0              && <Tag label="All clear" color={C.green} />}
        </div>
      </div>
    </WidgetShell>
  );
}

export function CashRunwayWidget({ data, editMode }: Props) {
  const runway = data.cashRunway;
  const burn   = data.avgMonthlyBurn;
  return (
    <WidgetShell editMode={editMode} label="Cash Runway">
      <div style={{ height: "100%", overflowY: "auto" }}>
        <StatLabel>Cash Runway</StatLabel>
        {runway !== null ? (
          <>
            <StatValue color={runway > 6 ? C.green : runway > 3 ? C.gold : C.red}>
              {runway.toFixed(1)} mo
            </StatValue>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 8, fontFamily: C.mono }}>
              Avg burn: {fmtShort(burn)}/mo
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 20, fontFamily: C.mono, color: C.textDim, fontWeight: 700 }}>—</div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 8, fontFamily: C.mono }}>
              Connect bank for live balance
            </div>
            <div style={{ fontSize: 11, color: C.textSec, marginTop: 4, fontFamily: C.mono }}>
              Avg burn: {fmtShort(burn)}/mo
            </div>
          </>
        )}
      </div>
    </WidgetShell>
  );
}
