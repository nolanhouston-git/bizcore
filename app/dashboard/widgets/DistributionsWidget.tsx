"use client";
import React from "react";
import { C, fmt, WidgetShell, StatLabel, StatValue } from "./shared";
import type { DashboardData } from "@/lib/dashboardData";

type Props = { data: DashboardData; editMode?: boolean; };

export function DistributionsWidget({ data, editMode }: Props) {
  const net      = data.scCorpNetIncome;
  const positive = net > 0;

  return (
    <WidgetShell editMode={editMode} label="Possible Distributions">
      <div style={{ height: "100%", overflowY: "auto" }}>
      <StatLabel>Possible Distributions</StatLabel>
      <StatValue color={positive ? C.green : C.gold}>
        {positive ? fmt(net) : "$0.00"}
      </StatValue>
      {!positive && (
        <div style={{ fontSize: 11, color: C.gold, marginTop: 6, fontFamily: C.mono }}>
          Salaries exceed current net income
        </div>
      )}
      {positive && (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginTop: 12 }}>
          {data.distributions.map(m => (
            <div key={m.name} style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", padding: "8px 12px", background: C.surfaceB,
              borderRadius: 8, border: `1px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize: 12, color: C.textPri, fontWeight: 600 }}>{m.name}</div>
                <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono }}>
                  {m.ownership_pct.toFixed(2)}% K-1
                </div>
              </div>
              <div style={{ fontSize: 15, fontFamily: C.mono, color: C.green, fontWeight: 700 }}>
                {fmt(m.distribution)}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, marginTop: 4, lineHeight: 1.5 }}>
            Net income − salaries − employer taxes. Not subject to SE tax.
          </div>
        </div>
      )}
      </div>
    </WidgetShell>
  );
}
