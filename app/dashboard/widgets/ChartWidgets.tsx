"use client";
import React from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { C, fmt, fmtShort, WidgetShell, StatLabel } from "./shared";
import type { DashboardData } from "@/lib/dashboardData";

type Props = { data: DashboardData; editMode?: boolean; };

const CHART_COLORS = [C.accent, C.purple, C.teal, C.gold, C.pink, C.green, C.red];

const tooltipStyle = {
  contentStyle: { background: C.surfaceB, border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: C.mono, fontSize: 12 },
  labelStyle: { color: C.textSec },
  itemStyle: { color: C.textPri },
};

export function SpendingByCategoryWidget({ data, editMode }: Props) {
  const chartData = data.spendingByCategory.slice(0, 8);
  return (
    <WidgetShell editMode={editMode} label="Spending by Category">
      <StatLabel>Spending by Category — YTD</StatLabel>
      <div style={{ height: "calc(100% - 24px)", minHeight: 200, overflowY: "auto" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="category" tick={{ fill: C.textDim, fontSize: 10, fontFamily: C.mono }}
              angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: C.textDim, fontSize: 10, fontFamily: C.mono }}
              tickFormatter={v => fmtShort(v)} />
            <Tooltip {...tooltipStyle} formatter={(((v: number | undefined) => v === undefined ? '' : fmt(v)) as any)} />
            <Bar dataKey="amount" fill={C.accent} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </WidgetShell>
  );
}

export function RevenueByCategoryWidget({ data, editMode }: Props) {
  const chartData = data.revenueByCategory.filter(d => d.amount > 0);
  return (
    <WidgetShell editMode={editMode} label="Revenue by Category">
      <StatLabel>Revenue by Category — YTD</StatLabel>
      <div style={{ height: "calc(100% - 24px)", minHeight: 200, overflowY: "auto" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="amount" nameKey="category"
              cx="50%" cy="50%" outerRadius="70%" innerRadius="40%"
              paddingAngle={2}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} formatter={(((v: number | undefined) => v === undefined ? '' : fmt(v)) as any)} />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: C.mono, color: C.textSec }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </WidgetShell>
  );
}

export function RevenueOverTimeWidget({ data, editMode }: Props) {
  const chartData = data.monthlyData.map(d => ({ name: d.label, Revenue: d.income }));
  return (
    <WidgetShell editMode={editMode} label="Revenue Over Time">
      <StatLabel>Revenue Over Time — Last 12 Months</StatLabel>
      <div style={{ height: "calc(100% - 24px)", minHeight: 200, overflowY: "auto" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="name" tick={{ fill: C.textDim, fontSize: 10, fontFamily: C.mono }} />
            <YAxis tick={{ fill: C.textDim, fontSize: 10, fontFamily: C.mono }} tickFormatter={v => fmtShort(v)} />
            <Tooltip {...tooltipStyle} formatter={(((v: number | undefined) => v === undefined ? '' : fmt(v)) as any)} />
            <Bar dataKey="Revenue" fill={C.green} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </WidgetShell>
  );
}

export function IncomeVsExpensesWidget({ data, editMode }: Props) {
  const chartData = data.monthlyData.map(d => ({
    name: d.label, Income: d.income, Expenses: d.expenses
  }));
  return (
    <WidgetShell editMode={editMode} label="Income vs Expenses">
      <StatLabel>Income vs Expenses — Last 12 Months</StatLabel>
      <div style={{ height: "calc(100% - 24px)", minHeight: 200, overflowY: "auto" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="name" tick={{ fill: C.textDim, fontSize: 10, fontFamily: C.mono }} />
            <YAxis tick={{ fill: C.textDim, fontSize: 10, fontFamily: C.mono }} tickFormatter={v => fmtShort(v)} />
            <Tooltip {...tooltipStyle} formatter={(((v: number | undefined) => v === undefined ? '' : fmt(v)) as any)} />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: C.mono, color: C.textSec }} />
            <Bar dataKey="Income"   fill={C.green}  radius={[4, 4, 0, 0]} />
            <Bar dataKey="Expenses" fill={C.accent} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </WidgetShell>
  );
}

export function CashFlowTrendWidget({ data, editMode }: Props) {
  const chartData = data.monthlyData.map(d => ({ name: d.label, "Net Cash Flow": d.net }));
  return (
    <WidgetShell editMode={editMode} label="Cash Flow Trend">
      <StatLabel>Cash Flow Trend — Last 12 Months</StatLabel>
      <div style={{ height: "calc(100% - 24px)", minHeight: 200, overflowY: "auto" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="name" tick={{ fill: C.textDim, fontSize: 10, fontFamily: C.mono }} />
            <YAxis tick={{ fill: C.textDim, fontSize: 10, fontFamily: C.mono }} tickFormatter={v => fmtShort(v)} />
            <Tooltip {...tooltipStyle} formatter={(((v: number | undefined) => v === undefined ? '' : fmt(v)) as any)} />
            <Line type="monotone" dataKey="Net Cash Flow" stroke={C.teal}
              strokeWidth={2} dot={{ fill: C.teal, r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </WidgetShell>
  );
}
