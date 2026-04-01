"use client";
import React from "react";
import { C, fmt, WidgetShell, StatLabel, Tag } from "./shared";
import type { DashboardData } from "@/lib/dashboardData";
import { formatDate } from "@/lib/dateFormat";

type Props = { data: DashboardData; editMode?: boolean; dateFormat: string; };

const JURISDICTION_COLORS: Record<string, string> = {
  federal:  C.accent,
  wa_state: C.green,
  seattle:  C.teal,
  employment: C.purple,
};

export function UpcomingTaxWidget({ data, editMode, dateFormat }: Props) {
  const deadlines = data.upcomingDeadlines;

  return (
    <WidgetShell editMode={editMode} label="Upcoming Tax">
      <div style={{ height: "100%", overflowY: "auto" }}>
      <StatLabel>Upcoming Tax Obligations</StatLabel>
      {deadlines.length === 0 ? (
        <div style={{ fontSize: 13, color: C.textDim, fontFamily: C.mono, marginTop: 8 }}>
          No deadlines within the next 90 days
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 10, marginTop: 8 }}>
          {deadlines.map(d => {
            const urgent = d.days_remaining <= 14;
            const soon   = d.days_remaining <= 30;
            const color  = urgent ? C.red : soon ? C.gold : C.green;
            const jColor = JURISDICTION_COLORS[d.jurisdiction] ?? C.textDim;
            return (
              <div key={d.id} style={{ background: C.surfaceB, border: `1px solid ${color}33`,
                borderRadius: 10, padding: "12px 16px",
                display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.textPri }}>{d.form_name}</span>
                    <Tag label={d.jurisdiction.replace("_"," ")} color={jColor} />
                  </div>
                  <div style={{ fontSize: 11, color: C.textSec }}>{d.description}</div>
                  <div style={{ fontSize: 11, color: C.textDim, fontFamily: C.mono, marginTop: 3 }}>
                    Due: {formatDate(d.due_date, dateFormat)}
                  </div>
                </div>
                <div style={{ textAlign: "right" as const, flexShrink: 0, marginLeft: 16 }}>
                  <div style={{ fontSize: 22, fontFamily: C.mono, color, fontWeight: 700 }}>
                    {d.days_remaining}
                  </div>
                  <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono }}>days</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </WidgetShell>
  );
}
