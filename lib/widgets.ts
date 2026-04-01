// Widget Registry — the single source of truth for all dashboard widgets.
// To add a new widget to the dashboard:
//   1. Add an entry to WIDGET_REGISTRY
//   2. Add its data key to DashboardData in lib/dashboardData.ts
//   3. Create its component in app/dashboard/widgets/
//   4. Add it to the switch statement in app/page.tsx
// That's it — the layout engine, customization UI, and persistence
// all work automatically for any registered widget.

export type WidgetSize = "normal" | "wide" | "full";

export type WidgetDefinition = {
  id: string;
  label: string;
  description: string;
  defaultLayout: { w: number; h: number }; // grid units (12-col grid)
  minW: number;
  minH: number;
  category: "metrics" | "charts" | "system";
};

// 12-column grid. Heights are in row units (~80px each).
// normal stat card:  w=3,  h=2
// wide stat/simple:  w=6,  h=2
// chart:             w=6,  h=4
// full-width:        w=12, h=3
export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  ytd_revenue: {
    id: "ytd_revenue",
    label: "YTD Revenue",
    description: "Total approved income for the current calendar year",
    defaultLayout: { w: 3, h: 2 },
    minW: 1, minH: 1,
    category: "metrics",
  },
  ytd_expenses: {
    id: "ytd_expenses",
    label: "YTD Expenses",
    description: "Total approved expenses for the current calendar year",
    defaultLayout: { w: 3, h: 2 },
    minW: 1, minH: 1,
    category: "metrics",
  },
  net_income: {
    id: "net_income",
    label: "Net Income",
    description: "YTD Revenue minus YTD Expenses",
    defaultLayout: { w: 3, h: 2 },
    minW: 1, minH: 1,
    category: "metrics",
  },
  pending_review: {
    id: "pending_review",
    label: "Pending Review",
    description: "Transactions awaiting approval across expenses and income",
    defaultLayout: { w: 3, h: 2 },
    minW: 1, minH: 1,
    category: "metrics",
  },
  cash_runway: {
    id: "cash_runway",
    label: "Cash Runway",
    description: "How many months of operating expenses current cash covers",
    defaultLayout: { w: 3, h: 2 },
    minW: 1, minH: 1,
    category: "metrics",
  },
  upcoming_tax: {
    id: "upcoming_tax",
    label: "Upcoming Tax Obligations",
    description: "Next 1–2 tax deadlines with estimates and days remaining",
    defaultLayout: { w: 6, h: 3 },
    minW: 2, minH: 2,
    category: "metrics",
  },
  distributions: {
    id: "distributions",
    label: "Possible Distributions",
    description: "S-Corp net income available for K-1 distributions per member",
    defaultLayout: { w: 3, h: 2 },
    minW: 1, minH: 1,
    category: "metrics",
  },
  spending_by_category: {
    id: "spending_by_category",
    label: "Spending by Category",
    description: "Expense breakdown by category as a bar chart",
    defaultLayout: { w: 6, h: 4 },
    minW: 2, minH: 2,
    category: "charts",
  },
  revenue_over_time: {
    id: "revenue_over_time",
    label: "Revenue Over Time",
    description: "Monthly revenue as a bar or line chart",
    defaultLayout: { w: 6, h: 4 },
    minW: 2, minH: 2,
    category: "charts",
  },
  income_vs_expenses: {
    id: "income_vs_expenses",
    label: "Income vs Expenses",
    description: "Side-by-side monthly comparison of income and expenses",
    defaultLayout: { w: 12, h: 4 },
    minW: 3, minH: 2,
    category: "charts",
  },
  cash_flow_trend: {
    id: "cash_flow_trend",
    label: "Cash Flow Trend",
    description: "Rolling 12-month net cash flow",
    defaultLayout: { w: 12, h: 4 },
    minW: 3, minH: 2,
    category: "charts",
  },
  revenue_by_category: {
    id: "revenue_by_category",
    label: "Revenue by Category",
    description: "Income breakdown by category as a donut chart",
    defaultLayout: { w: 6, h: 4 },
    minW: 2, minH: 2,
    category: "charts",
  },
  tax_snapshot: {
    id: "tax_snapshot",
    label: "S-Corp Tax Snapshot",
    description: "Revenue → Salaries → Expenses → Net Income waterfall",
    defaultLayout: { w: 12, h: 3 },
    minW: 1, minH: 1,
    category: "metrics",
  },
  system_status: {
    id: "system_status",
    label: "System Status",
    description: "Bank and Gusto connection status, pending transaction counts",
    defaultLayout: { w: 12, h: 2 },
    minW: 1, minH: 1,
    category: "system",
  },
};

// Default layout — what a fresh dashboard looks like.
// Each entry maps to a widget id with x,y position and w,h size.
export type LayoutItem = {
  i: string;   // widget id
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
};

export const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: "ytd_revenue",        x: 0,  y: 0, w: 3,  h: 2, visible: true },
  { i: "ytd_expenses",       x: 3,  y: 0, w: 3,  h: 2, visible: true },
  { i: "net_income",         x: 6,  y: 0, w: 3,  h: 2, visible: true },
  { i: "pending_review",     x: 9,  y: 0, w: 3,  h: 2, visible: true },
  { i: "cash_runway",        x: 0,  y: 2, w: 3,  h: 2, visible: true },
  { i: "upcoming_tax",       x: 3,  y: 2, w: 6,  h: 3, visible: true },
  { i: "distributions",      x: 9,  y: 2, w: 3,  h: 3, visible: true },
  { i: "spending_by_category",x: 0, y: 5, w: 6,  h: 4, visible: true },
  { i: "revenue_by_category", x: 6, y: 5, w: 6,  h: 4, visible: true },
  { i: "income_vs_expenses",  x: 0, y: 9, w: 12, h: 4, visible: true },
  { i: "cash_flow_trend",     x: 0, y: 13,w: 12, h: 4, visible: true },
  { i: "tax_snapshot",        x: 0, y: 17,w: 12, h: 3, visible: true },
  { i: "system_status",       x: 0, y: 20,w: 12, h: 2, visible: true },
  // Hidden by default — available in widget picker
  { i: "revenue_over_time",   x: 0, y: 23,w: 6,  h: 4, visible: false },
];
