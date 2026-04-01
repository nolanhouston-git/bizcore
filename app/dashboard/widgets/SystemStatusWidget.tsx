"use client";
import React, { useState, useEffect } from "react";
import { C, WidgetShell, StatLabel, Tag } from "./shared";
import type { DashboardData } from "@/lib/dashboardData";
import { formatDateTime } from "@/lib/dateFormat";

type Props = { data: DashboardData; editMode?: boolean; dateFormat: string; };

export function SystemStatusWidget({ data, editMode, dateFormat }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const items = [
    {
      label: "Bank Connection",
      status: data.bankConnected ? "Connected" : "Disconnected",
      color: data.bankConnected ? C.green : C.textDim,
      detail: data.lastBankSync ? `Last sync: ${formatDateTime(data.lastBankSync, dateFormat)}` : "Not connected",
    },
    {
      label: "Gusto Payroll",
      status: data.gustoConnected ? "Connected" : "Disconnected",
      color: data.gustoConnected ? C.pink : C.textDim,
      detail: data.lastGustoSync ? `Last sync: ${formatDateTime(data.lastGustoSync, dateFormat)}` : "Not connected",
    },
    {
      label: "Pending Expenses",
      status: data.pendingExpenses > 0 ? `${data.pendingExpenses} items` : "All clear",
      color: data.pendingExpenses > 0 ? C.gold : C.green,
      detail: data.pendingExpenses > 0 ? "Review in Expenses tab" : "Nothing pending",
    },
    {
      label: "Pending Income",
      status: data.pendingIncome > 0 ? `${data.pendingIncome} items` : "All clear",
      color: data.pendingIncome > 0 ? C.gold : C.green,
      detail: data.pendingIncome > 0 ? "Review in Income tab" : "Nothing pending",
    },
  ];

  return (
    <WidgetShell editMode={editMode} label="System Status">
      <StatLabel>System Status</StatLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 8, overflowY: "auto" }}>
        {items.map(item => (
          <div key={item.label} style={{ display: "flex", justifyContent: "space-between",
            alignItems: "center", padding: "10px 14px", background: C.surfaceB,
            borderRadius: 8, border: `1px solid ${C.border}` }}>
            <div>
              <div style={{ fontSize: 12, color: C.textSec, marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono }}>{mounted ? item.detail : ""}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: item.color,
                boxShadow: `0 0 6px ${item.color}` }} />
              <Tag label={item.status} color={item.color} />
            </div>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}
