"use client";
import React from "react";
import { C, fmt, WidgetShell, StatLabel } from "./shared";
import type { DashboardData } from "@/lib/dashboardData";

type Props = { data: DashboardData; editMode?: boolean; };

export function TaxSnapshotWidget({ data, editMode }: Props) {
  const steps = [
    { label: "YTD Revenue",       value: data.ytdRevenue,        color: C.green,  sign: "" },
    { label: "W-2 Salaries",      value: -data.totalSalaries,    color: C.red,    sign: "−" },
    { label: "Employer Taxes",    value: -data.totalEmployerTax, color: C.red,    sign: "−" },
    { label: "Other Expenses",    value: -(data.ytdExpenses - data.totalSalaries - data.totalEmployerTax), color: C.red, sign: "−" },
  ];
  const net = data.scCorpNetIncome;

  return (
    <WidgetShell editMode={editMode} label="S-Corp Tax Snapshot">
      <StatLabel>S-Corp Tax Snapshot — Waterfall</StatLabel>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 0, flexWrap: "wrap" as const, marginTop: 10, overflowY: "auto" }}>
        {steps.map((step, i) => {
          const isLast  = i === steps.length - 1;
          const maxVal  = data.ytdRevenue || 1;
          const barPct  = Math.min(100, (Math.abs(step.value) / maxVal) * 100);
          return (
            <React.Fragment key={step.label}>
              <div style={{ flex: "0 0 auto", padding: "8px 10px", background: C.surfaceB,
                border: `1px solid ${C.border}`, borderRadius: 8, margin: "3px" }}>
                <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, marginBottom: 4 }}>
                  {step.sign} {step.label}
                </div>
                <div style={{ fontSize: 14, fontFamily: C.mono, color: step.color, fontWeight: 700 }}>
                  {fmt(Math.abs(step.value))}
                </div>
                <div style={{ height: 3, background: C.border, borderRadius: 2, marginTop: 6 }}>
                  <div style={{ height: "100%", width: `${barPct}%`,
                    background: step.color, borderRadius: 2 }} />
                </div>
              </div>
              {!isLast && (
                <div style={{ fontSize: 16, color: C.textDim, padding: "0 4px", flexShrink: 0 }}>→</div>
              )}
            </React.Fragment>
          );
        })}
        <div style={{ fontSize: 16, color: C.textDim, padding: "0 4px", flexShrink: 0 }}>→</div>
        <div style={{ flex: "0 0 auto", padding: "8px 10px",
          background: net >= 0 ? C.greenDim : C.redDim,
          border: `1px solid ${net >= 0 ? C.green : C.red}44`,
          borderRadius: 8, margin: "3px" }}>
          <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, marginBottom: 4 }}>
            = S-Corp Net Income
          </div>
          <div style={{ fontSize: 14, fontFamily: C.mono,
            color: net >= 0 ? C.green : C.red, fontWeight: 700 }}>
            {fmt(net)}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, marginTop: 8 }}>
        Pass-through distributions above salaries are not subject to SE tax (IRC §1361)
      </div>
    </WidgetShell>
  );
}
